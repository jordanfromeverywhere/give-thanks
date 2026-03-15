import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Scanner } from "./index.js";

export const scanRequirements: Scanner = {
  detect(dir: string): boolean {
    return (
      existsSync(join(dir, "requirements.txt")) ||
      existsSync(join(dir, "pyproject.toml"))
    );
  },

  async scan(dir: string): Promise<string[]> {
    const deps = new Set<string>();

    // Parse requirements.txt
    const reqPath = join(dir, "requirements.txt");
    if (existsSync(reqPath)) {
      const lines = readFileSync(reqPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) {
          continue;
        }
        // Extract package name before version specifiers
        const match = trimmed.match(/^([a-zA-Z0-9._-]+)/);
        if (match) {
          deps.add(match[1].toLowerCase());
        }
      }
    }

    // Parse pyproject.toml (basic — just grab dependency names)
    const pyprojectPath = join(dir, "pyproject.toml");
    if (existsSync(pyprojectPath)) {
      const content = readFileSync(pyprojectPath, "utf-8");
      // Match lines like: "requests>=2.0", "flask", etc. inside dependencies arrays
      const depSection = content.match(
        /dependencies\s*=\s*\[([\s\S]*?)\]/
      );
      if (depSection) {
        const entries = depSection[1].matchAll(
          /["']([a-zA-Z0-9._-]+)/g
        );
        for (const entry of entries) {
          deps.add(entry[1].toLowerCase());
        }
      }
    }

    return Array.from(deps);
  },
};
