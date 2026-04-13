import fs from "node:fs/promises";
import path from "node:path";
import type { ImportEntry } from "./types.js";

/**
 * Extract all import references from a source file.
 * Returns entries with `fromFile` resolved to an absolute path (best-effort).
 */
export async function parseImports(
  file: string,
  knownFiles: Set<string>
): Promise<ImportEntry[]> {
  let src: string;
  try {
    src = await fs.readFile(file, "utf8");
  } catch {
    return [];
  }

  // Join multi-line import/export statements onto one line for simpler matching.
  // We detect an open brace without a close brace and merge with subsequent lines.
  const rawLines = src.split("\n");
  const lines: string[] = [];
  let pending = "";
  for (const raw of rawLines) {
    if (pending) {
      pending += " " + raw.trim();
      if (pending.includes("}")) {
        lines.push(pending);
        pending = "";
      }
      // don't push the raw line — it's been merged
      continue;
    }
    // Detect lines that start an import/export with { but don't close it
    if (/^\s*(import|export)\s+(type\s+)?\{/.test(raw) && !raw.includes("}")) {
      pending = raw.trim();
    } else {
      lines.push(raw);
    }
  }
  if (pending) lines.push(pending);

  const entries: ImportEntry[] = [];

  for (const line of lines) {
    // import { foo, bar as baz } from './path'  and  import type { ... } from './path'
    const namedImport = line.match(/^\s*import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
    if (namedImport) {
      const resolved = resolveImport(file, namedImport[2], knownFiles);
      if (resolved) {
        for (const spec of splitSpecifiers(namedImport[1])) {
          // "foo as bar" — the original export name is "foo"
          const asMatch = spec.match(/(\w+)\s+as\s+\w+/);
          const name = asMatch ? asMatch[1] : spec.trim();
          if (name && name !== "type") {
            entries.push({ name, fromFile: resolved, inFile: file });
          }
        }
      }
      continue;
    }

    // import defaultExport from './path'
    const defaultImport = line.match(/^\s*import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
    if (defaultImport && defaultImport[1] !== "type") {
      const resolved = resolveImport(file, defaultImport[2], knownFiles);
      if (resolved) {
        entries.push({ name: "default", fromFile: resolved, inFile: file });
      }
      continue;
    }

    // import defaultExport, { foo } from './path'
    const mixedImport = line.match(
      /^\s*import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/
    );
    if (mixedImport) {
      const resolved = resolveImport(file, mixedImport[3], knownFiles);
      if (resolved) {
        entries.push({ name: "default", fromFile: resolved, inFile: file });
        for (const spec of splitSpecifiers(mixedImport[2])) {
          const asMatch = spec.match(/(\w+)\s+as\s+\w+/);
          const name = asMatch ? asMatch[1] : spec.trim();
          if (name && name !== "type") {
            entries.push({ name, fromFile: resolved, inFile: file });
          }
        }
      }
      continue;
    }

    // import * as ns from './path'  (star import — marks all exports as used)
    const starImport = line.match(/^\s*import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/);
    if (starImport) {
      const resolved = resolveImport(file, starImport[1], knownFiles);
      if (resolved) {
        entries.push({ name: "*", fromFile: resolved, inFile: file });
      }
      continue;
    }

    // import './path'  (side-effect only — no names, but marks the file as touched)
    const sideEffect = line.match(/^\s*import\s+['"]([^'"]+)['"]/);
    if (sideEffect) {
      // No specific name imported — don't mark anything as used
      continue;
    }

    // Dynamic import: import('./path') or import('./path').then(...)
    const dynImport = line.match(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (dynImport) {
      const resolved = resolveImport(file, dynImport[1], knownFiles);
      if (resolved) {
        // We can't statically know which names are used — mark all as used
        entries.push({ name: "*", fromFile: resolved, inFile: file });
      }
      continue;
    }

    // require('./path') — CJS
    const requireCall = line.match(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (requireCall) {
      const resolved = resolveImport(file, requireCall[1], knownFiles);
      if (resolved) {
        entries.push({ name: "*", fromFile: resolved, inFile: file });
      }
      continue;
    }

    // export { foo, bar as baz } from './path'  and  export type { ... } from './path'
    const namedReexport = line.match(/^\s*export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
    if (namedReexport) {
      const resolved = resolveImport(file, namedReexport[2], knownFiles);
      if (resolved) {
        for (const spec of splitSpecifiers(namedReexport[1])) {
          // "foo as bar" — original export name is "foo"
          const asMatch = spec.match(/(\w+)\s+as\s+\w+/);
          const name = asMatch ? asMatch[1] : spec.trim();
          if (name && name !== "type") {
            entries.push({ name, fromFile: resolved, inFile: file });
          }
        }
      }
      continue;
    }

    // export * from './path' and export * as ns from './path'
    const starReexport = line.match(/^\s*export\s+\*(?:\s+as\s+\w+)?\s+from\s+['"]([^'"]+)['"]/);
    if (starReexport) {
      const resolved = resolveImport(file, starReexport[1], knownFiles);
      if (resolved) {
        entries.push({ name: "*", fromFile: resolved, inFile: file });
      }
    }
  }

  return entries;
}

const EXTENSIONS = [
  ".ts", ".tsx", ".mts", ".cts",
  ".js", ".jsx", ".mjs", ".cjs",
];

// TypeScript ESM uses .js in import specifiers but the actual file is .ts.
// Map from the written extension to the real extensions to try.
const EXT_REMAPS: Record<string, string[]> = {
  ".js":  [".ts", ".tsx", ".js", ".jsx"],
  ".mjs": [".mts", ".mjs"],
  ".cjs": [".cts", ".cjs"],
};

function resolveImport(
  fromFile: string,
  specifier: string,
  knownFiles: Set<string>
): string | null {
  // Only resolve relative imports — external packages are irrelevant
  if (!specifier.startsWith(".")) return null;

  const dir = path.dirname(fromFile);
  const base = path.resolve(dir, specifier);

  // Exact match (specifier already has extension and file exists as-is)
  if (knownFiles.has(base)) return base;

  // Handle TypeScript ESM: strip a known JS extension and try TS equivalents
  const writtenExt = EXTENSIONS.find((e) => base.endsWith(e));
  if (writtenExt) {
    const stem = base.slice(0, -writtenExt.length);
    const candidates = EXT_REMAPS[writtenExt] ?? [writtenExt];
    for (const ext of candidates) {
      const candidate = stem + ext;
      if (knownFiles.has(candidate)) return candidate;
    }
  }

  // Try appending extensions (specifier had no extension)
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (knownFiles.has(candidate)) return candidate;
  }

  // Try index file
  for (const ext of EXTENSIONS) {
    const candidate = path.join(base, `index${ext}`);
    if (knownFiles.has(candidate)) return candidate;
  }

  return null;
}

function splitSpecifiers(inner: string): string[] {
  return inner.split(",").map((s) => s.trim()).filter(Boolean);
}
