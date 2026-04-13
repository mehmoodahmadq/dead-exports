import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "../src/analyze.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

describe("analyze", () => {
  test("reports no dead exports when all exports are used", async () => {
    const result = await analyze({
      cwd: path.join(fixturesDir, "used"),
    });

    expect(result.deadExports).toHaveLength(0);
    expect(result.scannedFiles).toBe(2);
  });

  test("detects dead named exports", async () => {
    const result = await analyze({
      cwd: path.join(fixturesDir, "dead"),
    });

    const deadNames = result.deadExports.map((d) => d.name);
    expect(deadNames).toContain("deadHelper");
    expect(deadNames).toContain("DEAD_CONSTANT");
    expect(deadNames).toContain("default");
    expect(deadNames).not.toContain("usedHelper");
  });

  test("does not flag exports in entrypoint files", async () => {
    const result = await analyze({
      cwd: path.join(fixturesDir, "dead"),
      entrypoints: [path.join(fixturesDir, "dead", "utils.ts")],
    });

    expect(result.deadExports).toHaveLength(0);
  });

  test("star import marks all exports as used", async () => {
    const result = await analyze({
      cwd: path.join(fixturesDir, "star"),
    });

    expect(result.deadExports).toHaveLength(0);
    expect(result.scannedFiles).toBe(2);
  });

  test("--exclude glob skips matching files", async () => {
    // Excluding the consumer means nothing imports usedHelper — it becomes dead too
    const result = await analyze({
      cwd: path.join(fixturesDir, "dead"),
      exclude: ["**/consumer.ts"],
    });

    const deadNames = result.deadExports.map((d) => d.name);
    expect(deadNames).toContain("usedHelper");
  });

  test("result shape is correct", async () => {
    const result = await analyze({
      cwd: path.join(fixturesDir, "dead"),
    });

    expect(result).toHaveProperty("scannedFiles");
    expect(result).toHaveProperty("totalExports");
    expect(result).toHaveProperty("deadExports");

    for (const d of result.deadExports) {
      expect(d).toHaveProperty("name");
      expect(d).toHaveProperty("file");
      expect(d).toHaveProperty("line");
      expect(d).toHaveProperty("type");
    }
  });
});
