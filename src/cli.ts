#!/usr/bin/env node
import path from "node:path";
import pc from "picocolors";
import { analyze } from "./analyze.js";
import type { ScanOptions } from "./types.js";

function printHelp() {
  console.log(`
${pc.bold("dead-exports")} — find unused exports in your JS/TS codebase

${pc.bold("Usage:")}
  dead-exports [options]

${pc.bold("Options:")}
  --cwd <dir>          Root directory to scan (default: current directory)
  --include <glob>     Glob pattern(s) to include (repeatable)
  --exclude <glob>     Glob pattern(s) to exclude (repeatable)
  --entry <file>       Entry point file(s) — their exports are always considered used (repeatable)
  --json               Output results as JSON
  --help, -h           Show this help message

${pc.bold("Examples:")}
  dead-exports
  dead-exports --cwd ./src
  dead-exports --entry src/index.ts --entry src/server.ts
  dead-exports --exclude "**/*.test.ts" --json
`);
}

function parseArgs(argv: string[]): { options: ScanOptions; json: boolean; help: boolean } {
  const options: ScanOptions = {};
  let json = false;
  let help = false;
  const include: string[] = [];
  const exclude: string[] = [];
  const entrypoints: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        help = true;
        break;
      case "--json":
        json = true;
        break;
      case "--cwd":
        options.cwd = argv[++i];
        break;
      case "--include":
        include.push(argv[++i]);
        break;
      case "--exclude":
        exclude.push(argv[++i]);
        break;
      case "--entry":
        entrypoints.push(argv[++i]);
        break;
    }
  }

  if (include.length) options.include = include;
  if (exclude.length) options.exclude = exclude;
  if (entrypoints.length) options.entrypoints = entrypoints;

  return { options, json, help };
}

async function main() {
  const args = process.argv.slice(2);
  const { options, json, help } = parseArgs(args);

  if (help) {
    printHelp();
    process.exit(0);
  }

  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  options.cwd = cwd;

  if (!json) {
    console.log(pc.dim(`Scanning ${cwd} ...`));
  }

  let result;
  try {
    result = await analyze(options);
  } catch (err) {
    console.error(pc.red("Error: ") + String(err));
    process.exit(1);
  }

  if (json) {
    // Output machine-readable JSON, paths relative to cwd
    const output = {
      scannedFiles: result.scannedFiles,
      totalExports: result.totalExports,
      deadExports: result.deadExports.map((d) => ({
        ...d,
        file: path.relative(cwd, d.file),
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(result.deadExports.length > 0 ? 1 : 0);
  }

  // Human-readable output
  const { scannedFiles, totalExports, deadExports } = result;

  console.log(
    pc.dim(`Scanned ${scannedFiles} files, found ${totalExports} exports.`)
  );
  console.log();

  if (deadExports.length === 0) {
    console.log(pc.green("No dead exports found."));
    process.exit(0);
  }

  // Group by file for nicer output
  const byFile = new Map<string, typeof deadExports>();
  for (const d of deadExports) {
    const rel = path.relative(cwd, d.file);
    if (!byFile.has(rel)) byFile.set(rel, []);
    byFile.get(rel)!.push(d);
  }

  for (const [file, exports] of byFile) {
    console.log(pc.underline(pc.cyan(file)));
    for (const exp of exports) {
      const label =
        exp.type === "default"
          ? pc.yellow("default")
          : exp.type.includes("reexport")
          ? pc.magenta("re-export")
          : pc.red("named");
      const nameStr =
        exp.name === "default" ? pc.dim("(default export)") : pc.bold(exp.name);
      console.log(`  ${label}  ${nameStr}  ${pc.dim(`line ${exp.line}`)}`);
    }
    console.log();
  }

  console.log(
    pc.red(`Found ${deadExports.length} dead export${deadExports.length !== 1 ? "s" : ""}.`)
  );

  process.exit(1);
}

main();
