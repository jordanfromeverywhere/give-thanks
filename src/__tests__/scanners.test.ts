import { describe, it, expect } from "vitest";
import { scanPackageJson } from "../scan/package-json.js";
import { scanRequirements } from "../scan/requirements.js";
import { join } from "node:path";

const FIXTURES = join(import.meta.dirname, "fixtures");

describe("package.json scanner", () => {
  it("detects package.json", () => {
    expect(scanPackageJson.detect(join(FIXTURES, "npm-project"))).toBe(true);
  });

  it("returns false when no package.json", () => {
    expect(scanPackageJson.detect(join(FIXTURES, "empty-project"))).toBe(false);
  });

  it("scans dependencies and devDependencies", async () => {
    const deps = await scanPackageJson.scan(join(FIXTURES, "npm-project"));
    expect(deps).toContain("chalk");
    expect(deps).toContain("commander");
    expect(deps).toContain("vitest");
  });
});

describe("requirements scanner", () => {
  it("detects requirements.txt", () => {
    expect(scanRequirements.detect(join(FIXTURES, "python-project"))).toBe(true);
  });

  it("returns false when no requirements files", () => {
    expect(scanRequirements.detect(join(FIXTURES, "empty-project"))).toBe(false);
  });

  it("parses requirements.txt", async () => {
    const deps = await scanRequirements.scan(join(FIXTURES, "python-project"));
    expect(deps).toContain("requests");
    expect(deps).toContain("flask");
    expect(deps).not.toContain(""); // no empty entries
  });

  it("skips comments and flags", async () => {
    const deps = await scanRequirements.scan(join(FIXTURES, "python-project"));
    expect(deps).not.toContain("#");
    expect(deps).not.toContain("-r");
  });

  it("parses pyproject.toml", async () => {
    const deps = await scanRequirements.scan(join(FIXTURES, "pyproject-project"));
    expect(deps).toContain("httpx");
    expect(deps).toContain("pydantic");
  });
});
