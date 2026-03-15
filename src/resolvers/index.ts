import { resolveNpm } from "./npm.js";
import { resolvePypi } from "./pypi.js";
import { resolveGithub } from "./github.js";

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface Resolver {
  name: string;
  canResolve(input: string): boolean;
  resolve(input: string): Promise<RepoRef | null>;
}

const resolvers: Resolver[] = [
  resolveGithub,
  resolveNpm,
  resolvePypi,
];

export async function resolveRepo(input: string): Promise<RepoRef | null> {
  for (const resolver of resolvers) {
    if (resolver.canResolve(input)) {
      const result = await resolver.resolve(input);
      if (result) return result;
    }
  }
  return null;
}
