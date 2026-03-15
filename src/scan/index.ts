import { scanPackageJson } from "./package-json.js";
import { scanRequirements } from "./requirements.js";

export interface Scanner {
  detect(dir: string): boolean;
  scan(dir: string): Promise<string[]>;
}

const scanners: Scanner[] = [scanPackageJson, scanRequirements];

export async function scanDependencies(dir: string): Promise<string[]> {
  const allDeps: Set<string> = new Set();

  for (const scanner of scanners) {
    if (scanner.detect(dir)) {
      const deps = await scanner.scan(dir);
      deps.forEach((d) => allDeps.add(d));
    }
  }

  return Array.from(allDeps).sort();
}
