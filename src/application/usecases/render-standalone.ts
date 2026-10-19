// `md`'s use case: one Markdown file to one standalone HTML page.
//
// The source and the page are files, so the use case reads and writes them
// through the `FileSystem` port; the drawing itself is the `StandaloneRenderer`
// port's business. The output directory is created if it is not there, so
// `geek-book md a/notes.md out/notes.html` works in a fresh tree.

import { fail, ok, type Result } from "../../domain/diagnostics.js";
import { dirname } from "../../domain/values/posix-path.js";
import type { FileSystem } from "../ports/file-system.js";
import type { StandaloneRenderer } from "../ports/standalone-renderer.js";

export interface RenderStandaloneDeps {
  readonly fs: FileSystem;
  readonly standalone: StandaloneRenderer;
}

/** Render `input`'s Markdown into `output`, creating its directory. */
export async function renderStandalone(
  deps: RenderStandaloneDeps,
  input: string,
  output: string,
): Promise<Result<void>> {
  const source = deps.fs.readText(input);
  if (source === null) {
    return fail({ severity: "error", code: "md/no-file", message: `${input}: no such file` });
  }
  const html = await deps.standalone.render(source);
  if (!html.ok) {
    return html;
  }
  deps.fs.makeDirs(dirname(output));
  deps.fs.writeText(output, html.value);
  return ok(undefined);
}
