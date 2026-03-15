import type { Resolver } from "./index.js";

export const resolvePypi: Resolver = {
  name: "pypi",

  canResolve(input: string): boolean {
    // Try PyPI for anything that's not an owner/repo pattern
    return !input.includes("/");
  },

  async resolve(input: string) {
    try {
      const res = await fetch(`https://pypi.org/pypi/${input}/json`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;

      const data = await res.json();
      const urls = data.info?.project_urls || {};

      // Check common URL keys for GitHub links
      const candidates = [
        urls["Source"],
        urls["Source Code"],
        urls["Homepage"],
        urls["Repository"],
        urls["GitHub"],
        urls["Code"],
        data.info?.home_page,
      ];

      for (const url of candidates) {
        if (!url) continue;
        const match = url.match(/github\.com\/([^/]+)\/([^/.#]+)/);
        if (match) {
          return { owner: match[1], repo: match[2] };
        }
      }

      return null;
    } catch {
      return null;
    }
  },
};
