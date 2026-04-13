# dead-exports

Find unused/dead exports across your JavaScript and TypeScript codebase. Statically analyzes your source files to identify exports that are never imported anywhere, helping you clean up dead code and reduce bundle size.

## Installation

```bash
npm install -g @mehmoodahmadq/dead-exports
# or run without installing
npx @mehmoodahmadq/dead-exports
```

## Usage

```bash
dead-exports [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--cwd <dir>` | Root directory to scan (default: current directory) |
| `--include <glob>` | Glob pattern(s) to include (repeatable) |
| `--exclude <glob>` | Glob pattern(s) to exclude (repeatable) |
| `--entry <file>` | Entry point file(s) — their exports are always considered used (repeatable) |
| `--json` | Output results as JSON |
| `--help`, `-h` | Show help |

### Examples

```bash
# Scan current directory
dead-exports

# Scan a specific directory
dead-exports --cwd ./src

# Mark entry points so their exports aren't flagged
dead-exports --entry src/index.ts --entry src/server.ts

# Exclude test files and output JSON
dead-exports --exclude "**/*.test.ts" --json
```

## Output

By default, dead exports are grouped by file with the export name, type, and line number:

```
src/utils.ts
  named    formatDate  line 12
  named    parseQuery  line 28

Found 2 dead exports.
```

With `--json`, results are machine-readable and the process exits with code `1` if any dead exports are found (useful for CI).

## Programmatic API

```ts
import { analyze } from '@mehmoodahmadq/dead-exports';

const result = await analyze({
  cwd: './src',
  include: ['**/*.ts'],
  exclude: ['**/*.test.ts'],
  entrypoints: ['src/index.ts'],
});

console.log(result.deadExports);
```

### `ScanOptions`

| Option | Type | Description |
|--------|------|-------------|
| `cwd` | `string` | Root directory to scan. Defaults to `process.cwd()` |
| `include` | `string[]` | Glob patterns to include. Defaults to `**/*.{js,mjs,cjs,ts,mts,cts}` |
| `exclude` | `string[]` | Glob patterns to exclude. Defaults to `node_modules`, `dist`, `build`, `coverage` |
| `entrypoints` | `string[]` | Files whose exports are always considered used |

### `AnalysisResult`

```ts
interface AnalysisResult {
  scannedFiles: number;
  totalExports: number;
  deadExports: DeadExport[];
}

interface DeadExport {
  name: string;
  file: string;   // absolute path
  line: number;
  type: 'named' | 'default' | 'named-reexport' | 'star-reexport';
}
```

## License

MIT
