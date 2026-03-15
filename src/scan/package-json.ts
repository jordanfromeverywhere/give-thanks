import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Scanner } from "./index.js";

export const scanPackageJson: Scanner = {
  detect(dir: string): boolean {
    return existsSync(join(dir, "package.json"));
  },

  async scan(dir: string): Promise<string[]> {
    try {
      const raw = readFileSync(join(dir, "package.json"), "utf-8");
      const pkg = JSON.parse(raw);
      const deps = new Set<string>();

      for (const key of ["dependencies", "devDependencies"]) {
        if (pkg[key] && typeof pkg[key] === "object") {
          Object.keys(pkg[key]).forEach((d) => deps.add(d));
        }
      }

      return Array.from(deps);
    } catch {
      return [];
    }
  },
};
