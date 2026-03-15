import { describe, it, expect, vi, beforeEach } from "vitest";
import { getHistory, hasBeenThanked, addToHistory } from "../history.js";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

vi.mock("node:fs/promises");

const HISTORY_DIR = join(homedir(), ".give-thanks");
const HISTORY_FILE = join(HISTORY_DIR, "history.json");

const mockEntry = {
  repo: "chalk/chalk",
  package: "chalk",
  ecosystem: "npm",
  thankedAt: "2026-03-14T10:00:00Z",
  discussionUrl: "https://github.com/chalk/chalk/discussions/1",
};

describe("getHistory", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when no history file", async () => {
    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("ENOENT"));
    const history = await getHistory();
    expect(history).toEqual([]);
  });

  it("returns parsed history", async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify([mockEntry]));
    const history = await getHistory();
    expect(history).toEqual([mockEntry]);
  });
});

describe("hasBeenThanked", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true for thanked package", async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify([mockEntry]));
    expect(await hasBeenThanked("chalk")).toBe(true);
  });

  it("returns true for thanked repo", async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify([mockEntry]));
    expect(await hasBeenThanked("chalk/chalk")).toBe(true);
  });

  it("returns false for unthanked package", async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify([mockEntry]));
    expect(await hasBeenThanked("commander")).toBe(false);
  });
});

describe("addToHistory", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("appends entry to existing history", async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify([mockEntry]));
    vi.mocked(fs.mkdir).mockResolvedValueOnce(undefined);
    vi.mocked(fs.writeFile).mockResolvedValueOnce(undefined);

    const newEntry = {
      repo: "user/repo",
      package: "repo",
      ecosystem: "npm",
      thankedAt: "2026-03-14T11:00:00Z",
    };

    await addToHistory(newEntry);

    expect(fs.writeFile).toHaveBeenCalledWith(
      HISTORY_FILE,
      expect.stringContaining("user/repo")
    );
  });

  it("creates history from empty when no file exists", async () => {
    vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("ENOENT"));
    vi.mocked(fs.mkdir).mockResolvedValueOnce(undefined);
    vi.mocked(fs.writeFile).mockResolvedValueOnce(undefined);

    await addToHistory(mockEntry);

    expect(fs.mkdir).toHaveBeenCalledWith(HISTORY_DIR, { recursive: true });
    expect(fs.writeFile).toHaveBeenCalled();
  });
});
