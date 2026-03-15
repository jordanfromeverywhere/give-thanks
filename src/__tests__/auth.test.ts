import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authenticate } from "../auth.js";
import * as child_process from "node:child_process";

vi.mock("node:child_process");
vi.mock("@clack/prompts", () => ({
  log: { info: vi.fn(), warn: vi.fn() },
}));

describe("authenticate", () => {
  const originalEnv = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GITHUB_TOKEN = originalEnv;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
  });

  it("returns token from gh CLI", async () => {
    vi.mocked(child_process.execSync).mockReturnValueOnce("ghp_test123\n");
    const token = await authenticate();
    expect(token).toBe("ghp_test123");
  });

  it("falls back to GITHUB_TOKEN env var", async () => {
    vi.mocked(child_process.execSync).mockImplementationOnce(() => {
      throw new Error("ENOENT");
    });
    process.env.GITHUB_TOKEN = "env_token_123";
    const token = await authenticate();
    expect(token).toBe("env_token_123");
  });

  it("returns null when no auth available", async () => {
    vi.mocked(child_process.execSync).mockImplementationOnce(() => {
      throw new Error("ENOENT");
    });
    const token = await authenticate();
    expect(token).toBeNull();
  });

  it("detects gh not installed (ENOENT)", async () => {
    const { log } = await import("@clack/prompts");
    vi.mocked(child_process.execSync).mockImplementationOnce(() => {
      throw new Error("ENOENT: command not found");
    });
    await authenticate();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("Install the GitHub CLI")
    );
  });

  it("detects gh installed but not authenticated", async () => {
    const { log } = await import("@clack/prompts");
    vi.mocked(child_process.execSync).mockImplementationOnce(() => {
      throw new Error("not logged in");
    });
    await authenticate();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("not authenticated")
    );
  });
});
