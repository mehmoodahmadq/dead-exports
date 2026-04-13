import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseImports } from "../src/parse-imports.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures", "imports");
const targetFile = path.join(fixturesDir, "target.ts");
const knownFiles = new Set([targetFile]);

describe("parseImports", () => {
  test("parses named imports", async () => {
    const entries = await parseImports(path.join(fixturesDir, "named.ts"), knownFiles);
    const names = entries.map((e) => e.name);
    expect(names).toContain("foo");
    expect(names).toContain("bar");
    expect(entries[0].fromFile).toBe(targetFile);
  });

  test("parses default import", async () => {
    const entries = await parseImports(path.join(fixturesDir, "default-import.ts"), knownFiles);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("default");
    expect(entries[0].fromFile).toBe(targetFile);
  });

  test("parses star import as wildcard", async () => {
    const entries = await parseImports(path.join(fixturesDir, "star.ts"), knownFiles);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("*");
  });

  test("parses mixed import (default + named)", async () => {
    const entries = await parseImports(path.join(fixturesDir, "mixed.ts"), knownFiles);
    const names = entries.map((e) => e.name);
    expect(names).toContain("default");
    expect(names).toContain("foo");
  });

  test("import type { ... } is treated conservatively as marking exports used", async () => {
    const entries = await parseImports(path.join(fixturesDir, "type-only.ts"), knownFiles);
    // Conservative: type-only imports still mark exports as used to avoid false positives
    expect(entries.map((e) => e.name)).toContain("foo");
  });

  test("parses dynamic import as wildcard", async () => {
    const entries = await parseImports(path.join(fixturesDir, "dynamic.ts"), knownFiles);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("*");
  });

  test("parses require() as wildcard", async () => {
    const entries = await parseImports(path.join(fixturesDir, "cjs-consumer.ts"), knownFiles);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("*");
  });

  test("parses named re-export as import from source", async () => {
    const entries = await parseImports(path.join(fixturesDir, "reexport-named.ts"), knownFiles);
    const names = entries.map((e) => e.name);
    expect(names).toContain("foo");
    expect(names).toContain("bar");
  });

  test("parses star re-export as wildcard", async () => {
    const entries = await parseImports(path.join(fixturesDir, "reexport-star.ts"), knownFiles);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("*");
  });

  test("ignores external package imports", async () => {
    const entries = await parseImports(path.join(fixturesDir, "external.ts"), knownFiles);
    expect(entries).toHaveLength(0);
  });

  test("returns empty array for non-existent file", async () => {
    const entries = await parseImports("/does/not/exist.ts", knownFiles);
    expect(entries).toHaveLength(0);
  });
});
