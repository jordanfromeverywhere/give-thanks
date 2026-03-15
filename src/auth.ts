import { execSync } from "node:child_process";
import { log } from "@clack/prompts";

export async function authenticate(): Promise<string | null> {
  // 1. Try gh CLI
  const ghToken = tryGhCli();
  if (ghToken) {
    log.info("Authenticated via GitHub CLI.");
    return ghToken;
  }

  // 2. Try GITHUB_TOKEN env var
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) {
    log.info("Authenticated via GITHUB_TOKEN environment variable.");
    return envToken;
  }

  // 3. No auth found
  log.warn(
    "No GitHub authentication found.\n" +
      "Install the GitHub CLI (gh) and run `gh auth login`,\n" +
      "or set the GITHUB_TOKEN environment variable."
  );
  return null;
}

function tryGhCli(): string | null {
  try {
    const result = execSync("gh auth token", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const token = result.trim();
    return token || null;
  } catch {
    return null;
  }
}
