import path from "node:path";

/** Collects the linter's findings, prefixed with the file's repo-relative path. */
export class Reporter {
  readonly errors: string[] = [];
  readonly warnings: string[] = [];
  // Expected while the book is being written; summarised instead of listed.
  readonly notes: string[] = [];

  constructor(private readonly root: string) {}

  private where(file: string, line: number | null): string {
    const base = path.relative(this.root, file);
    return line === null ? base : `${base}:${line}`;
  }

  error(file: string, line: number | null, message: string): void {
    this.errors.push(`${this.where(file, line)}: ${message}`);
  }

  warn(file: string, line: number | null, message: string): void {
    this.warnings.push(`${this.where(file, line)}: ${message}`);
  }
}
