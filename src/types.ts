export interface ExportEntry {
  name: string;       // exported name, e.g. "myFunction" or "default"
  file: string;       // absolute path of the file that exports it
  line: number;       // line number of the export statement
  type: ExportType;
}

export type ExportType =
  | "named"
  | "default"
  | "named-reexport"  // export { foo } from './bar'
  | "star-reexport";  // export * from './bar'

export interface ImportEntry {
  name: string;       // imported name (resolved to the export name)
  fromFile: string;   // absolute path of the file being imported from
  inFile: string;     // absolute path of the file doing the importing
}

export interface DeadExport {
  name: string;
  file: string;
  line: number;
  type: ExportType;
}

export interface AnalysisResult {
  scannedFiles: number;
  totalExports: number;
  deadExports: DeadExport[];
}

export interface ScanOptions {
  /** Glob patterns to include. Defaults to ["**\/*.{js,mjs,cjs,ts,mts,cts}"] */
  include?: string[];
  /** Glob patterns to exclude. Defaults to ["node_modules", "dist", "build", "coverage"] */
  exclude?: string[];
  /** Root directory to scan. Defaults to cwd. */
  cwd?: string;
  /** Treat index files as entry points (their exports are not dead). Default: true */
  entrypoints?: string[];
}
