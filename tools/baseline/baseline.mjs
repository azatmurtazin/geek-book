#!/usr/bin/env node
// tools/baseline/baseline.mjs — the reference baseline for the rewrite.
//
//   node tools/baseline/baseline.mjs capture <dir>     write the artifacts
//   node tools/baseline/baseline.mjs compare <ref> <dir>  diff them
//
// Six artifacts freeze what the engine produces today, so a refactor can prove
// it changed nothing (see docs/ARCHITECTURE_REFACTORING_PLAN.md §9):
//
//   web.sha256   sorted sha256 of every file under build/html/ (path-relative;
//                fetched images/remote/ excluded — see below)
//   book.txt     pdftotext -layout of build/book.pdf, whitespace-normalised
//   book.info    Pages: / Page size: lines from pdfinfo
//   lint.txt     `geek-book lint` on the guide (stdout+stderr)
//   config.json  `geek-book config`
//   md.html      `geek-book md test/fixtures/golden/chapter.md`
//
// The website, lint, config and md artifacts are byte-exact and safe to
// regenerate on any machine. The two PDF artifacts depend on poppler and the
// installed fonts, so the reference copy under test/baseline/ is captured
// inside docker/Docker.book (see `just docker-baseline`); `compare` compares
// them only inside that image (detected via /.dockerenv or GEEK_BOOK_DOCKER=1),
// and says so otherwise. `--pdf` / `--no-pdf` override the detection.
//
// The PDF is compared semantically — extracted text, page count and page size —
// not byte-for-byte, because two builds of the same LaTeX differ in timestamps,
// object order and font subsetting while the readable page stays the same.

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const engine = path.join(root, "bin", "geek-book.mjs");
const htmlDir = path.join(root, "build", "html");
const pdfFile = path.join(root, "build", "book.pdf");
const goldenMd = "test/fixtures/golden/chapter.md";

// Remote images are fetched from someone else's server and written under the
// site root. Their bytes are not the engine's output, and re-fetching a moved
// upstream file must not fail the baseline; the HTML hash still freezes every
// reference to them. See src/lib/remote-images.ts (REMOTE_IMAGE_DIR).
const FETCHED_IMAGE_DIR = "images/remote/";

const BYTE_EXACT = ["web.sha256", "lint.txt", "config.json", "md.html"];
const PDF_ARTIFACTS = ["book.txt", "book.info"];

function fail(message) {
  process.stderr.write(`baseline: ${message}\n`);
  process.exit(1);
}

/** Run a command from the repo root; return { status, stdout, stderr }. */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.error) {
    fail(`could not run ${command}: ${result.error.message}`);
  }
  return result;
}

/** Run a tool, failing loudly when it is missing. */
function tool(command, args) {
  const result = run(command, args);
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} exited ${result.status}\n${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** build/html/ → `<sha256>  <path-relative-to-html>`, sorted by path. */
function webHashes() {
  if (!fs.existsSync(htmlDir)) fail(`no ${path.relative(root, htmlDir)}/ — run \`just html\` first`);
  const rels = walk(htmlDir)
    .map((file) => path.relative(htmlDir, file).split(path.sep).join("/"))
    .filter((rel) => !rel.startsWith(FETCHED_IMAGE_DIR))
    .sort();
  return `${rels.map((rel) => `${sha256(path.join(htmlDir, rel))}  ${rel}`).join("\n")}\n`;
}

/** pdftotext -layout, with runs of whitespace and page breaks normalised away. */
function pdfText() {
  if (!fs.existsSync(pdfFile)) fail(`no ${path.relative(root, pdfFile)} — run \`just pdf\` first`);
  const raw = tool("pdftotext", ["-layout", pdfFile, "-"]);
  return (
    raw
      .replace(/\r\n?/g, "\n")
      .replace(/\f/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n+$/, "") + "\n"
  );
}

/** The Pages: and Page size: lines from pdfinfo, spacing normalised. */
function pdfInfo() {
  if (!fs.existsSync(pdfFile)) fail(`no ${path.relative(root, pdfFile)} — run \`just pdf\` first`);
  const info = tool("pdfinfo", [pdfFile]);
  const lines = info
    .split("\n")
    .filter((line) => /^(Pages:|Page size:)/.test(line))
    .map((line) => line.replace(/\s+/g, " ").trim());
  return `${lines.join("\n")}\n`;
}

/** stdout+stderr of `geek-book lint` on the guide. Nonzero exit is data, not a failure. */
function lintOutput() {
  const result = run(process.execPath, [engine, "lint"]);
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

/** stdout of `geek-book config`. */
function configOutput() {
  const result = run(process.execPath, [engine, "config"]);
  if (result.status !== 0) fail(`geek-book config exited ${result.status}\n${result.stderr ?? ""}`);
  return result.stdout ?? "";
}

/** `geek-book md` on the golden chapter, written to a temp file so the fixture is untouched. */
function mdOutput() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-md-"));
  try {
    const out = path.join(tmp, "chapter.html");
    const result = run(process.execPath, [engine, "md", goldenMd, out]);
    if (result.status !== 0) fail(`geek-book md exited ${result.status}\n${result.stderr ?? ""}`);
    return fs.readFileSync(out, "utf8");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const ARTIFACTS = {
  "web.sha256": webHashes,
  "book.txt": pdfText,
  "book.info": pdfInfo,
  "lint.txt": lintOutput,
  "config.json": configOutput,
  "md.html": mdOutput,
};

function capture(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, produce] of Object.entries(ARTIFACTS)) {
    fs.writeFileSync(path.join(dir, name), produce());
    process.stdout.write(`baseline: wrote ${path.relative(root, path.join(dir, name))}\n`);
  }
}

const inDocker = (() => {
  if (process.env.GEEK_BOOK_DOCKER === "1") return true;
  return fs.existsSync("/.dockerenv");
})();

/** The first line on which two texts differ, for a readable failure. */
function firstDiff(a, b) {
  const left = a.split("\n");
  const right = b.split("\n");
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) {
      return `line ${i + 1}\n    baseline: ${left[i] ?? "<missing>"}\n    current:  ${right[i] ?? "<missing>"}`;
    }
  }
  return "content differs";
}

function compare(refDir, dir, pdf) {
  let failed = false;
  const check = (name, label) => {
    const ref = path.join(refDir, name);
    const cur = path.join(dir, name);
    if (!fs.existsSync(ref)) {
      process.stdout.write(`baseline: ${label} not baselined yet — skipped\n`);
      return;
    }
    if (!fs.existsSync(cur)) {
      process.stdout.write(`baseline: ${label} MISSING (${path.relative(root, cur)}) — FAIL\n`);
      failed = true;
      return;
    }
    const a = fs.readFileSync(ref, "utf8");
    const b = fs.readFileSync(cur, "utf8");
    if (a === b) {
      process.stdout.write(`baseline: ${label} ok\n`);
      return;
    }
    failed = true;
    process.stdout.write(`baseline: ${label} CHANGED\n  ${firstDiff(a, b)}\n`);
  };

  for (const name of BYTE_EXACT) check(name, name);
  if (pdf) {
    for (const name of PDF_ARTIFACTS) check(name, name);
  } else {
    process.stdout.write(
      "baseline: book.txt / book.info not compared (outside docker/Docker.book; " +
        "run `just docker-baseline && just verify` in the book image for the PDF)\n",
    );
  }
  return failed ? 1 : 0;
}

const [command, ...rest] = process.argv.slice(2);
if (command === "capture" && rest.length === 1) {
  capture(path.resolve(root, rest[0]));
} else if (command === "compare" && rest.length >= 2) {
  const flags = rest.slice(2);
  const pdf = flags.includes("--no-pdf") ? false : flags.includes("--pdf") ? true : inDocker;
  process.exitCode = compare(path.resolve(root, rest[0]), path.resolve(root, rest[1]), pdf);
} else {
  process.stderr.write(
    "usage: baseline.mjs capture <dir>\n" +
      "       baseline.mjs compare <ref-dir> <dir> [--pdf|--no-pdf]\n",
  );
  process.exit(2);
}
