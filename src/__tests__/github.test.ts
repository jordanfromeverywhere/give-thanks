import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

// Mock history
vi.mock("../history.js", () => ({
  addToHistory: vi.fn(),
}));

// Mock email
const mockSendEmail = vi.fn();
vi.mock("../email.js", () => ({
  sendThankYouEmail: (...args: any[]) => mockSendEmail(...args),
}));

// Mock Octokit
const mockStarRepo = vi.fn();
const mockCreateIssue = vi.fn();
const mockGraphql = vi.fn();
const mockGetByUsername = vi.fn();

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(function () {
    return {
      activity: { starRepoForAuthenticatedUser: mockStarRepo },
      issues: { create: mockCreateIssue },
      users: { getByUsername: mockGetByUsername },
      graphql: mockGraphql,
    };
  }),
}));

const ref = { owner: "chalk", repo: "chalk" };
const message = { title: "Thanks!", body: "You rock!" };

// Helper: mock discussions unavailable (empty categories)
function mockNoDiscussions() {
  mockGraphql.mockResolvedValueOnce({
    repository: {
      id: "R_123",
      discussionCategories: { nodes: [] },
    },
  });
}

// Helper: mock discussions available
function mockDiscussionsAvailable(url = "https://github.com/chalk/chalk/discussions/99") {
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
        discussion: { url },
      },
    });
}

// Helper: mock owner profile
function mockProfile(data: { email?: string; blog?: string; twitter_username?: string } = {}) {
  mockGetByUsername.mockResolvedValueOnce({
    data: {
      email: data.email || null,
      blog: data.blog || null,
      twitter_username: data.twitter_username || null,
    },
  });
}

describe("thankPackage", () => {
  beforeEach(() => {
    mockStarRepo.mockReset();
    mockCreateIssue.mockReset();
    mockGraphql.mockReset();
    mockGetByUsername.mockReset();
    mockSendEmail.mockReset();
  });

  it("stars repo and posts discussion when available — channel 'discussion'", async () => {
    const { thankPackage } = await import("../github.js");
    mockStarRepo.mockResolvedValueOnce({});
    mockDiscussionsAvailable();

    const result = await thankPackage("token", ref, message);
    expect(result.starred).toBe(true);
    expect(result.messageSent).toBe(true);
    expect(result.channel).toBe("discussion");
    expect(result.discussionUrl).toContain("discussions/99");
  });

  it("falls back to issue when discussions unavailable — channel 'issue'", async () => {
    const { thankPackage } = await import("../github.js");
    mockStarRepo.mockResolvedValueOnce({});
    mockNoDiscussions();
    mockCreateIssue.mockResolvedValueOnce({
      data: { html_url: "https://github.com/chalk/chalk/issues/42" },
    });

    const result = await thankPackage("token", ref, message);
    expect(result.starred).toBe(true);
    expect(result.messageSent).toBe(true);
    expect(result.channel).toBe("issue");
    expect(result.discussionUrl).toContain("issues/42");
  });

  it("falls back to email when discussion + issue both fail — channel 'email'", async () => {
    const { thankPackage } = await import("../github.js");
    mockStarRepo.mockResolvedValueOnce({});
    mockNoDiscussions();
    const issueErr: any = new Error("Forbidden");
    issueErr.status = 403;
    mockCreateIssue.mockRejectedValueOnce(issueErr);
    mockProfile({ email: "maintainer@example.com", blog: "https://example.com" });
    mockSendEmail.mockResolvedValueOnce(true);

    const result = await thankPackage("token", ref, message);
    expect(result.starred).toBe(true);
    expect(result.messageSent).toBe(true);
    expect(result.channel).toBe("email");
    expect(mockSendEmail).toHaveBeenCalledWith(
      "maintainer@example.com",
      "Thanks!",
      "You rock!"
    );
  });

  it("falls back to star-only when all channels fail — channel 'star-only'", async () => {
    const { thankPackage } = await import("../github.js");
    mockStarRepo.mockResolvedValueOnce({});
    mockNoDiscussions();
    const issueErr: any = new Error("Gone");
    issueErr.status = 410;
    mockCreateIssue.mockRejectedValueOnce(issueErr);
    mockProfile({}); // no email

    const result = await thankPackage("token", ref, message);
    expect(result.starred).toBe(true);
    expect(result.messageSent).toBe(false);
    expect(result.channel).toBe("star-only");
  });

  it("returns profile links in result", async () => {
    const { thankPackage } = await import("../github.js");
    mockStarRepo.mockResolvedValueOnce({});
    mockNoDiscussions();
    const issueErr: any = new Error("Forbidden");
    issueErr.status = 403;
    mockCreateIssue.mockRejectedValueOnce(issueErr);
    mockProfile({
      email: "dev@example.com",
      blog: "https://blog.example.com",
      twitter_username: "devhandle",
    });
    mockSendEmail.mockResolvedValueOnce(false); // email send fails

    const result = await thankPackage("token", ref, message);
    expect(result.channel).toBe("star-only");
    expect(result.profileLinks).toEqual({
      email: "dev@example.com",
      blog: "https://blog.example.com",
      twitter: "@devhandle",
    });
  });

  it("dry-run does not make API calls", async () => {
    const { thankPackage } = await import("../github.js");
    const result = await thankPackage("token", ref, message, { dryRun: true });
    expect(result.summary).toContain("dry-run");
    expect(result.channel).toBe("star-only");
    expect(mockStarRepo).not.toHaveBeenCalled();
    expect(mockGraphql).not.toHaveBeenCalled();
  });

  it("passes original package name to history", async () => {
    const { thankPackage } = await import("../github.js");
    const { addToHistory } = await import("../history.js");
    mockStarRepo.mockResolvedValueOnce({});
    mockDiscussionsAvailable("https://github.com/chalk/chalk/discussions/1");

    await thankPackage("token", ref, message, { packageName: "chalk" });
    expect(addToHistory).toHaveBeenCalledWith(
      expect.objectContaining({ package: "chalk", channel: "discussion" })
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
    mockDiscussionsAvailable("https://github.com/chalk/chalk/discussions/1");

    const result = await thankPackage("token", ref, message);
    expect(result.starred).toBe(true);
    expect(result.channel).toBe("discussion");
  });
});
