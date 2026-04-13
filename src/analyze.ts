import path from "node:path";
import { collectFiles } from "./collect-files.js";
import { parseExports } from "./parse-exports.js";
import { parseImports } from "./parse-imports.js";
import type { AnalysisResult, DeadExport, ScanOptions } from "./types.js";

export async function analyze(options: ScanOptions = {}): Promise<AnalysisResult> {
  const files = await collectFiles(options);
  const knownFiles = new Set(files);

  // Resolve entrypoints to absolute paths
  const cwd = options.cwd ?? process.cwd();
  const entrypoints = new Set(
    (options.entrypoints ?? []).map((e) => path.resolve(cwd, e))
  );

  // 1. Collect all exports across all files
  const allExports = await Promise.all(files.map((f) => parseExports(f)));

  // 2. Collect all imports across all files
  const allImports = await Promise.all(
    files.map((f) => parseImports(f, knownFiles))
  );

  // 3. Build a set of "used" keys: "<absoluteFile>|<exportName>"
  const usedKeys = new Set<string>();

  for (const fileImports of allImports) {
    for (const imp of fileImports) {
      if (imp.name === "*") {
        // Star import/require — mark ALL exports from that file as used
        usedKeys.add(`${imp.fromFile}|*`);
      } else {
        usedKeys.add(`${imp.fromFile}|${imp.name}`);
      }
    }
  }

  // 4. Find dead exports
  const dead: DeadExport[] = [];
  let totalExports = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const exports = allExports[i];

    // If file is an entrypoint, all its exports are "used" by external consumers
    if (entrypoints.has(file)) continue;

    // Also skip if the file is an index file specified as entrypoint implicitly
    // (user can pass entrypoints: ['src/index.ts'] explicitly)

    totalExports += exports.length;

    for (const exp of exports) {
      const key = `${file}|${exp.name}`;
      const starKey = `${file}|*`;

      if (!usedKeys.has(key) && !usedKeys.has(starKey)) {
        dead.push({
          name: exp.name,
          file: exp.file,
          line: exp.line,
          type: exp.type,
        });
      }
    }
  }

  return {
    scannedFiles: files.length,
    totalExports,
    deadExports: dead,
  };
}
