import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveGithub } from "../resolvers/github.js";
import { resolveNpm } from "../resolvers/npm.js";
import { resolvePypi } from "../resolvers/pypi.js";

describe("github resolver", () => {
  it("recognizes owner/repo format", () => {
    expect(resolveGithub.canResolve("sindresorhus/chalk")).toBe(true);
    expect(resolveGithub.canResolve("user/repo")).toBe(true);
  });

  it("rejects plain package names", () => {
    expect(resolveGithub.canResolve("chalk")).toBe(false);
    expect(resolveGithub.canResolve("@scope/pkg")).toBe(false);
  });

  it("resolves to owner and repo", async () => {
    const result = await resolveGithub.resolve("sindresorhus/chalk");
    expect(result).toEqual({ owner: "sindresorhus", repo: "chalk" });
  });
});

describe("npm resolver", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts plain package names", () => {
    expect(resolveNpm.canResolve("chalk")).toBe(true);
    expect(resolveNpm.canResolve("@clack/prompts")).toBe(true);
  });

  it("rejects owner/repo format", () => {
    expect(resolveNpm.canResolve("user/repo")).toBe(false);
  });

  it("resolves npm package to github repo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        repository: {
          url: "git+https://github.com/chalk/chalk.git",
        },
      }),
    } as Response);

    const result = await resolveNpm.resolve("chalk");
    expect(result).toEqual({ owner: "chalk", repo: "chalk" });
  });

  it("handles git:// URLs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        repository: {
          url: "git://github.com/user/repo.git",
        },
      }),
    } as Response);

    const result = await resolveNpm.resolve("some-pkg");
    expect(result).toEqual({ owner: "user", repo: "repo" });
  });

  it("handles github: shorthand", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        repository: "github:user/repo",
      }),
    } as Response);

    const result = await resolveNpm.resolve("some-pkg");
    expect(result).toEqual({ owner: "user", repo: "repo" });
  });

  it("returns null for non-GitHub repos", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        repository: {
          url: "https://gitlab.com/user/repo.git",
        },
      }),
    } as Response);

    const result = await resolveNpm.resolve("some-pkg");
    expect(result).toBeNull();
  });

  it("returns null on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response);

    const result = await resolveNpm.resolve("nonexistent-pkg");
    expect(result).toBeNull();
  });

  it("returns null on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));

    const result = await resolveNpm.resolve("chalk");
    expect(result).toBeNull();
  });
});

describe("pypi resolver", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts plain package names", () => {
    expect(resolvePypi.canResolve("requests")).toBe(true);
  });

  it("rejects owner/repo format", () => {
    expect(resolvePypi.canResolve("user/repo")).toBe(false);
  });

  it("resolves from project_urls.Source", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        info: {
          project_urls: {
            Source: "https://github.com/psf/requests",
          },
        },
      }),
    } as Response);

    const result = await resolvePypi.resolve("requests");
    expect(result).toEqual({ owner: "psf", repo: "requests" });
  });

  it("resolves from home_page fallback", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        info: {
          project_urls: {},
          home_page: "https://github.com/user/repo",
        },
      }),
    } as Response);

    const result = await resolvePypi.resolve("some-pkg");
    expect(result).toEqual({ owner: "user", repo: "repo" });
  });

  it("returns null when no GitHub URL found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        info: {
          project_urls: {
            Homepage: "https://example.com",
          },
        },
      }),
    } as Response);

    const result = await resolvePypi.resolve("some-pkg");
    expect(result).toBeNull();
  });

  it("returns null on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response);

    const result = await resolvePypi.resolve("nonexistent");
    expect(result).toBeNull();
  });
});
