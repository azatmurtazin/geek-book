// Split a fenced code block into plain-code and comment runs, so every render
// target agrees on where comments start and end: the HTML renderer wraps the
// comment runs in `<span class="code-comment">`, the LaTeX renderer colors the
// same runs. Strings are kept inside the code runs so `//` and `#` inside them
// are not mistaken for comments.

import { HASH_COMMENT_LANGS, SLASH_COMMENT_LANGS } from "./langs.js";

export interface CodeSegment {
  readonly kind: "code" | "comment";
  readonly text: string;
}

/** Index just past the string opening at `start` (triple-quoted handled). */
function stringEnd(code: string, start: number): number {
  const quote = code[start];
  if (code[start + 1] === quote && code[start + 2] === quote) {
    let i = start + 3;
    while (i + 2 < code.length) {
      if (code[i] === quote && code[i + 1] === quote && code[i + 2] === quote) {
        return i + 3;
      }
      i += 1;
    }
    return code.length;
  }
  let i = start + 1;
  let escaped = false;
  while (i < code.length) {
    const ch = code[i];
    if (escaped) escaped = false;
    else if (ch === "\\") escaped = true;
    else if (ch === quote) return i + 1;
    i += 1;
  }
  return code.length;
}

/**
 * Cut `code` into code and comment segments for `lang` (lowercase). Languages
 * with no comment syntax yield a single code segment. Consecutive plain-code
 * characters — including strings — stay in one run; comment runs keep the
 * exact boundaries the HTML renderer has always highlighted.
 */
export function tokenizeCode(code: string, lang: string): CodeSegment[] {
  const slash = SLASH_COMMENT_LANGS.has(lang);
  const hash = HASH_COMMENT_LANGS.has(lang);
  if (!slash && !hash) return [{ kind: "code", text: code }];

  const segments: CodeSegment[] = [];
  let runStart = 0;
  const flushRun = (end: number): void => {
    if (end > runStart) segments.push({ kind: "code", text: code.slice(runStart, end) });
  };

  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    let end: number;
    if (slash && code.startsWith("/*", i)) {
      const close = code.indexOf("*/", i + 2);
      end = close === -1 ? code.length : close + 2;
    } else if ((slash && code.startsWith("//", i)) || (hash && ch === "#" && !(lang === "php" && code[i + 1] === "["))) {
      const nl = code.indexOf("\n", i);
      end = nl === -1 ? code.length : nl;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      i = stringEnd(code, i);
      continue;
    } else {
      i += 1;
      continue;
    }
    flushRun(i);
    segments.push({ kind: "comment", text: code.slice(i, end) });
    i = end;
    runStart = end;
  }
  flushRun(code.length);
  return segments;
}
