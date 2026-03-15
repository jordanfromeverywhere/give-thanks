import { execSync } from "node:child_process";
import { log } from "@clack/prompts";

export async function authenticate(): Promise<string | null> {
  // 1. Try gh CLI
  const ghResult = tryGhCli();
  if (ghResult.token) {
    log.info("Authenticated via GitHub CLI.");
    return ghResult.token;
  }

  // 2. Try GITHUB_TOKEN env var
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) {
    log.info("Authenticated via GITHUB_TOKEN environment variable.");
    return envToken;
  }

  // 3. No auth found — give specific guidance
  if (ghResult.error === "not-installed") {
    log.warn(
      "No GitHub authentication found.\n" +
        "Option 1: Install the GitHub CLI → https://cli.github.com then run `gh auth login`\n" +
        "Option 2: Set the GITHUB_TOKEN environment variable."
    );
  } else if (ghResult.error === "not-authenticated") {
    log.warn(
      "GitHub CLI found but not authenticated.\n" +
        "Run `gh auth login` to authenticate,\n" +
        "or set the GITHUB_TOKEN environment variable."
    );
  } else {
    log.warn(
      "No GitHub authentication found.\n" +
        "Install the GitHub CLI (gh) and run `gh auth login`,\n" +
        "or set the GITHUB_TOKEN environment variable."
    );
  }
  return null;
}

interface GhResult {
  token: string | null;
  error?: "not-installed" | "not-authenticated" | "unknown";
}

function tryGhCli(): GhResult {
  try {
    const result = execSync("gh auth token", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const token = result.trim();
    return { token: token || null, error: token ? undefined : "not-authenticated" };
  } catch (err: any) {
    const message = err.message || "";
    if (message.includes("not found") || message.includes("ENOENT") || message.includes("is not recognized")) {
      return { token: null, error: "not-installed" };
    }
    // gh is installed but auth failed
    return { token: null, error: "not-authenticated" };
  }
}
