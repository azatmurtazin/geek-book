// The port the builders read Markdown through.
//
// A parser turns source into the neutral tree (see `domain/model/markdown.ts`);
// which parser it is, and whether the tree came from `marked`, is an adapter's
// business (see `adapters/markdown/marked-parser.ts`). The tree types are
// re-exported here so a caller can name them from the port, but they are
// defined in the domain, where the services that consume them may reach them
// without importing the application layer.

import type { MdNode } from "../../domain/model/markdown.js";

export type { MdInline, MdNode } from "../../domain/model/markdown.js";

/** Turn Markdown source into the neutral document tree. */
export interface MarkdownParser {
  lex(source: string): MdNode[];
}
