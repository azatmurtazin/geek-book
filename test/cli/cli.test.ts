// The CLI surface itself: which stream a message goes to, which exit code a
// failure returns, and that `--config` can point at a book elsewhere. These
// cases spawn `bin/geek-book.mjs`, because the launcher runs `main` at import
// time — the behaviour that matters is the process's, not a function's.
//
// The messages asserted here are the contract the architecture refactor kept:
// `error:` diagnostics from the reporter, `geek-book: <message>` for a command's
// own failure, usage lines on stderr, and 0/1/2 as the exit codes.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const bin = path.join(repo, "bin", "geek-book.mjs");
const minimal = path.join(repo, "test", "fixtures", "minimal");

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-cli-"));
  tempDirs.push(dir);
  return dir;
}

/** Run the CLI in `cwd`; return its exit code and both streams as text. */
function cli(args: string[], cwd: string) {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A smallest-possible book that builds a website. */
function tinyBook(): string {
  const root = tempDir();
  const files: Record<string, string> = {
    "book.config.json": JSON.stringify({ title: "Tiny" }),
    "book/SUMMARY.md": "# Summary\n\n- [One](chapters/00_index.md)\n",
    "book/chapters/00_index.md": "# One\n\nHello.\n",
  };
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return root;
}

describe("usage and exit codes", () => {
  it("prints help on stderr and exits 0 when asked", () => {
    const run = cli(["help"], tempDir());
    expect(run.code).toBe(0);
    expect(run.stderr).toContain("usage: geek-book <command> [args]");
    expect(run.stdout).toBe("");
  });

  it("exits 2 and prints help when no command is given", () => {
    const run = cli([], tempDir());
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("usage: geek-book <command> [args]");
  });

  it("reports an unknown command through the reporter and exits 2", () => {
    const run = cli(["nope"], tempDir());
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("error: unknown command 'nope'");
  });

  it("rejects a --config without a value", () => {
    const run = cli(["--config"], tempDir());
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("error: --config needs a file");
  });
});

describe("config", () => {
  it("prints the resolved book as JSON", () => {
    const run = cli(["config"], minimal);
    expect(run.code).toBe(0);
    expect(run.stderr).toBe("");
    expect(JSON.parse(run.stdout).title).toBe("Fixture Book");
  });

  it("builds the book beside --config rather than the working directory", () => {
    const run = cli(["config", "--config", path.join(minimal, "book.config.json")], tempDir());
    expect(run.code).toBe(0);
    const printed = JSON.parse(run.stdout);
    expect(printed.title).toBe("Fixture Book");
    // Paths are printed relative to the book root, which is always ".".
    expect(printed.root).toBe(".");
    expect(printed.configFile).toBe("book.config.json");
  });
});

describe("lint", () => {
  it("prints errors on stderr, a summary, and exits 1", () => {
    const run = cli(["lint"], minimal);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("error: book/SUMMARY.md: missing");
    expect(run.stderr).toContain("error: chapters/: missing directory");
    // The summary follows the findings' stream: stderr when anything is an error.
    expect(run.stderr).toContain("0 chapter file(s), 2 error(s), 0 warning(s)");
  });

  it("exits 2 on an unknown family", () => {
    const run = cli(["lint", "nope"], minimal);
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("lint: unknown check 'nope'");
  });
});

describe("md and pdf-info", () => {
  it("renders a file and names the pair it wrote", () => {
    const root = tinyBook();
    fs.writeFileSync(path.join(root, "page.md"), "# Page\n\nText.\n");
    const run = cli(["md", "page.md"], root);
    expect(run.code).toBe(0);
    expect(run.stdout).toBe("geek-book: page.md -> page.html\n");
    expect(fs.readFileSync(path.join(root, "page.html"), "utf8")).toContain("Text.");
  });

  it("names a missing source under the geek-book prefix and exits 2", () => {
    const run = cli(["md", "missing.md"], tempDir());
    expect(run.code).toBe(2);
    expect(run.stderr).toBe("geek-book: missing.md: no such file\n");
  });

  it("names a missing PDF as the reader typed it and exits 2", () => {
    const run = cli(["pdf-info", "missing.pdf"], tempDir());
    expect(run.code).toBe(2);
    expect(run.stderr).toBe("geek-book: missing.pdf: no such file\n");
  });
});

describe("web", () => {
  it("builds the site and exits 0", () => {
    const root = tinyBook();
    const run = cli(["web"], root);
    expect(run.code).toBe(0);
    expect(run.stderr).toBe("");
    const page = fs.readFileSync(path.join(root, "build", "html", "chapters", "00_index.html"), "utf8");
    expect(page).toContain("Hello.");
  });

  it("prints the usage line and exits 2 for too many arguments", () => {
    const run = cli(["web", "a", "b"], tempDir());
    expect(run.code).toBe(2);
    expect(run.stderr).toBe("usage: geek-book web [output-dir]\n");
  });
});
