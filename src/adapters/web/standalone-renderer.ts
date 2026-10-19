// The standalone-page adapter: one Markdown file wrapped in the site layout.
//
// It implements the application's `StandaloneRenderer` port over
// `md-to-html/render.ts`, which does the drawing. That module throws when a
// fence cannot be drawn or a remote image cannot be fetched; a use case wants a
// value, so the throw becomes a diagnostic here.

import { fail, ok, type Result } from "../../domain/diagnostics.js";
import { renderStandaloneHtmlFromSource } from "../../md-to-html/render.js";
import type { StandaloneRenderer } from "../../application/ports/standalone-renderer.js";
import type { BookSettings } from "../../application/settings.js";

export class LayoutStandaloneRenderer implements StandaloneRenderer {
  constructor(private readonly settings: BookSettings) {}

  async render(source: string): Promise<Result<string>> {
    try {
      return ok(await renderStandaloneHtmlFromSource(this.settings, source));
    } catch (error) {
      return fail({ severity: "error", code: "md/render", message: (error as Error).message });
    }
  }
}
