import { glob } from "glob";
import path from "node:path";
import type { ScanOptions } from "./types.js";

const DEFAULT_INCLUDE = ["**/*.{js,mjs,cjs,ts,mts,cts}"];
const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.git/**",
];

export async function collectFiles(options: ScanOptions = {}): Promise<string[]> {
  const cwd = options.cwd ?? process.cwd();
  const include = options.include ?? DEFAULT_INCLUDE;
  const excludePatterns = DEFAULT_EXCLUDE.concat(
    (options.exclude ?? []).map((p) => (p.includes("**") ? p : `**/${p}/**`))
  );

  const results: string[] = [];

  for (const pattern of include) {
    const matches = await glob(pattern, {
      cwd,
      absolute: true,
      ignore: excludePatterns,
      nodir: true,
    });
    results.push(...matches);
  }

  // Deduplicate and normalize
  return [...new Set(results.map((f) => path.normalize(f)))].sort();
}
