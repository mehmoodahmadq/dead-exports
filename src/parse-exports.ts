import fs from "node:fs/promises";
import type { ExportEntry } from "./types.js";

/**
 * Extract all exports from a source file using regex-based parsing.
 * Covers the most common real-world patterns without requiring a full AST parser.
 */
export async function parseExports(file: string): Promise<ExportEntry[]> {
  let src: string;
  try {
    src = await fs.readFile(file, "utf8");
  } catch {
    return [];
  }

  const entries: ExportEntry[] = [];
  const lines = src.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // export default
    if (/^\s*export\s+default\s/.test(line)) {
      entries.push({ name: "default", file, line: lineNum, type: "default" });
      continue;
    }

    // export * from './foo'  (star re-export)
    if (/^\s*export\s+\*\s+from\s+['"]/.test(line)) {
      entries.push({ name: "*", file, line: lineNum, type: "star-reexport" });
      continue;
    }

    // export * as ns from './foo'  (namespace re-export — treat as named)
    const nsReexport = line.match(/^\s*export\s+\*\s+as\s+(\w+)\s+from\s+['"]/);
    if (nsReexport) {
      entries.push({ name: nsReexport[1], file, line: lineNum, type: "named-reexport" });
      continue;
    }

    // export { foo, bar as baz } from './foo'  (named re-export)
    const namedReexport = line.match(/^\s*export\s+\{([^}]+)\}\s+from\s+['"]/);
    if (namedReexport) {
      for (const spec of splitSpecifiers(namedReexport[1])) {
        // "foo as bar" — the exported name is "bar"
        const asMatch = spec.match(/\w+\s+as\s+(\w+)/);
        const name = asMatch ? asMatch[1] : spec.trim();
        if (name) {
          entries.push({ name, file, line: lineNum, type: "named-reexport" });
        }
      }
      continue;
    }

    // export { foo, bar as baz }  (named export without from)
    const namedBrace = line.match(/^\s*export\s+\{([^}]+)\}/);
    if (namedBrace) {
      for (const spec of splitSpecifiers(namedBrace[1])) {
        const asMatch = spec.match(/\w+\s+as\s+(\w+)/);
        const name = asMatch ? asMatch[1] : spec.trim();
        if (name) {
          entries.push({ name, file, line: lineNum, type: "named" });
        }
      }
      continue;
    }

    // export const/let/var/function/class/type/interface/enum foo
    const declaration = line.match(
      /^\s*export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|type|interface|enum|abstract\s+class)\s+(\w+)/
    );
    if (declaration) {
      entries.push({ name: declaration[1], file, line: lineNum, type: "named" });
      continue;
    }

    // export default function/class (anonymous) — already caught above, but named variant:
    const defaultNamed = line.match(
      /^\s*export\s+default\s+(?:async\s+)?(?:function\*?|class)\s+(\w+)/
    );
    if (defaultNamed) {
      // already captured as "default" above; skip duplicate
      continue;
    }
  }

  return entries;
}

function splitSpecifiers(inner: string): string[] {
  return inner.split(",").map((s) => s.trim()).filter(Boolean);
}
