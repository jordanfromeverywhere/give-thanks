import type { Resolver } from "./index.js";

export const resolveNpm: Resolver = {
  name: "npm",

  canResolve(input: string): boolean {
    // Anything that's not an owner/repo pattern could be an npm package
    return !input.includes("/") || input.startsWith("@");
  },

  async resolve(input: string) {
    try {
      const res = await fetch(`https://registry.npmjs.org/${input}`);
      if (!res.ok) return null;

      const data = await res.json();
      const repoUrl =
        data.repository?.url || data.repository?.toString() || "";

      return extractGithubRepo(repoUrl);
    } catch {
      return null;
    }
  },
};

function extractGithubRepo(
  url: string
): { owner: string; repo: string } | null {
  // Handle various GitHub URL formats:
  // git+https://github.com/owner/repo.git
  // https://github.com/owner/repo
  // git://github.com/owner/repo.git
  // github:owner/repo
  const patterns = [
    /github\.com[/:]([^/]+)\/([^/.#]+)/,
    /^github:([^/]+)\/([^/.#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }

  return null;
}
