// Split a fenced code block into plain-code and comment runs, so every render
// target agrees on where comments start and end. The tokenizer is pure and now
// lives in `domain/services/code-tokenizer.ts`; this is the legacy path the
// renderers still name.

export { tokenizeCode, type CodeSegment } from "../domain/services/code-tokenizer.js";
