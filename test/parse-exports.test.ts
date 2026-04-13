import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseExports } from "../src/parse-exports.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

describe("parseExports", () => {
  test("parses named function/const exports", async () => {
    const entries = await parseExports(path.join(fixturesDir, "used", "math.ts"));
    const names = entries.map((e) => e.name);
    expect(names).toContain("add");
    expect(names).toContain("subtract");
    expect(names).toContain("PI");
  });

  test("parses default export", async () => {
    const entries = await parseExports(path.join(fixturesDir, "dead", "utils.ts"));
    const defaultExp = entries.find((e) => e.name === "default");
    expect(defaultExp).toBeDefined();
    expect(defaultExp?.type).toBe("default");
  });

  test("returns empty array for non-existent file", async () => {
    const entries = await parseExports("/does/not/exist.ts");
    expect(entries).toHaveLength(0);
  });
});
