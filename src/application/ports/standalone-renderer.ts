// The port the `md` command renders one Markdown file through.
//
// A standalone page is HTML, so it lives in an adapter
// (`adapters/web/standalone-renderer.ts`) over the `_layouts/default.html`
// layout. The use case reads the source, asks the renderer for the page and
// writes it; a source the renderer cannot draw comes back as a diagnostic
// rather than an exception.

import type { Result } from "../../domain/diagnostics.js";

export interface StandaloneRenderer {
  /** One Markdown source as a whole HTML page. */
  render(source: string): Promise<Result<string>>;
}
