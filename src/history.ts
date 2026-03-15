import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { log } from "@clack/prompts";

export interface HistoryEntry {
  repo: string;
  package: string;
  ecosystem: string;
  thankedAt: string;
  discussionUrl?: string;
  channel?: string;
}

const HISTORY_DIR = join(homedir(), ".give-thanks");
const HISTORY_FILE = join(HISTORY_DIR, "history.json");

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const data = await readFile(HISTORY_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function hasBeenThanked(pkg: string): Promise<boolean> {
  const history = await getHistory();
  return history.some((h) => h.package === pkg || h.repo === pkg);
}

export async function addToHistory(entry: HistoryEntry): Promise<void> {
  const history = await getHistory();
  history.push(entry);
  await mkdir(HISTORY_DIR, { recursive: true });
  await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

export async function printHistory(): Promise<void> {
  const history = await getHistory();

  if (history.length === 0) {
    log.info("No gratitude history yet. Start thanking some maintainers!");
    return;
  }

  log.info(`You've thanked ${history.length} package${history.length === 1 ? "" : "s"}:\n`);

  for (const entry of history) {
    const date = entry.thankedAt.split("T")[0];
    const url = entry.discussionUrl ? ` → ${entry.discussionUrl}` : "";
    console.log(`  ${entry.repo} (${date})${url}`);
  }
}
