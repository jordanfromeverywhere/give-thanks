import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

// Mock history
vi.mock("../history.js", () => ({
  addToHistory: vi.fn(),
}));

// Mock Octokit
const mockStarRepo = vi.fn();
const mockCreateIssue = vi.fn();
const mockGraphql = vi.fn();

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(function () {
    return {
      activity: { starRepoForAuthenticatedUser: mockStarRepo },
      issues: { create: mockCreateIssue },
      graphql: mockGraphql,
    };
  }),
}));

const ref = { owner: "chalk", repo: "chalk" };
const message = { title: "Thanks!", body: "You rock!" };

describe("thankPackage", () => {
  beforeEach(() => {
    mockStarRepo.mockReset();
    mockCreateIssue.mockReset();
    mockGraphql.mockReset();
  });

  it("stars repo and posts discussion when available", async () => {
    const { thankPackage } = await import("../github.js");
    mockStarRepo.mockResolvedValueOnce({});
    mockGraphql
      .mockResolvedValueOnce({
        repository: {
          id: "R_123",
          discussionCategories: {
            nodes: [{ id: "DC_1", name: "General" }],
          },
        },
      })
      .mockResolvedValueOnce({
        createDiscussion: {
          discussion: { url: "https://github.com/chalk/chalk/discussions/99" },
        },
      });

    const result = await thankPackage("token", ref, message);
    expect(result.starred).toBe(true);
    expect(result.messageSent).toBe(true);
    expect(result.discussionUrl).toContain("discussions/99");
  });

  it("dry-run does not make API calls", async () => {
    const { thankPackage } = await import("../github.js");
    const result = await thankPackage("token", ref, message, { dryRun: true });
    expect(result.summary).toContain("dry-run");
    expect(mockStarRepo).not.toHaveBeenCalled();
    expect(mockGraphql).not.toHaveBeenCalled();
  });

  it("passes original package name to history", async () => {
    const { thankPackage } = await import("../github.js");
    const { addToHistory } = await import("../history.js");
    mockStarRepo.mockResolvedValueOnce({});
    mockGraphql
      .mockResolvedValueOnce({
        repository: {
          id: "R_123",
          discussionCategories: {
            nodes: [{ id: "DC_1", name: "General" }],
          },
        },
      })
      .mockResolvedValueOnce({
        createDiscussion: {
          discussion: { url: "https://github.com/chalk/chalk/discussions/1" },
        },
      });

    await thankPackage("token", ref, message, { packageName: "chalk" });
    expect(addToHistory).toHaveBeenCalledWith(
      expect.objectContaining({ package: "chalk" })
    );
  });

  it("handles rate limiting (403)", async () => {
    const { thankPackage } = await import("../github.js");
    const err: any = new Error("rate limited");
    err.status = 403;
    err.response = { headers: {} };
    mockStarRepo.mockRejectedValueOnce(err);

    const result = await thankPackage("token", ref, message);
    expect(result.summary).toContain("Rate limited");
    expect(result.starred).toBe(false);
  });

  it("handles rate limiting (429)", async () => {
    const { thankPackage } = await import("../github.js");
    const err: any = new Error("rate limited");
    err.status = 429;
    err.response = { headers: { "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 60) } };
    mockStarRepo.mockRejectedValueOnce(err);

    const result = await thankPackage("token", ref, message);
    expect(result.summary).toContain("Rate limited");
  });

  it("handles already-starred (304)", async () => {
    const { thankPackage } = await import("../github.js");
    const err: any = new Error("Not Modified");
    err.status = 304;
    mockStarRepo.mockRejectedValueOnce(err);
    mockGraphql
      .mockResolvedValueOnce({
        repository: {
          id: "R_123",
          discussionCategories: {
            nodes: [{ id: "DC_1", name: "General" }],
          },
        },
      })
      .mockResolvedValueOnce({
        createDiscussion: {
          discussion: { url: "https://github.com/chalk/chalk/discussions/1" },
        },
      });

    const result = await thankPackage("token", ref, message);
    expect(result.starred).toBe(true);
  });
});
