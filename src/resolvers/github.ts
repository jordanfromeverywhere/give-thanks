import type { Resolver } from "./index.js";

const GITHUB_REPO_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export const resolveGithub: Resolver = {
  name: "github",

  canResolve(input: string): boolean {
    return GITHUB_REPO_PATTERN.test(input);
  },

  async resolve(input: string) {
    const [owner, repo] = input.split("/");
    return { owner, repo };
  },
};
