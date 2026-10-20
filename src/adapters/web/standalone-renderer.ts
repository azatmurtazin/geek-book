// The standalone-page adapter: one Markdown file wrapped in the site layout.
//
// It implements the application's `StandaloneRenderer` port over
// `standalone-page.ts`, which does the drawing, and asks the `TemplateStore` for
// the layout the page is wrapped in. That module throws when a fence cannot be
// drawn or a remote image cannot be fetched; a use case wants a value, so the
// throw becomes a diagnostic here.

import { fail, ok, type Result } from "../../domain/diagnostics.js";
import { renderStandaloneHtmlFromSource } from "./standalone-page.js";
import type { StandaloneRenderer } from "../../application/ports/standalone-renderer.js";
import type { TemplateStore } from "../../application/ports/template-store.js";
import type { BookSettings } from "../../application/settings.js";

export class LayoutStandaloneRenderer implements StandaloneRenderer {
  constructor(
    private readonly settings: BookSettings,
    private readonly templates: TemplateStore,
  ) {}

  async render(source: string): Promise<Result<string>> {
    try {
      return ok(
        await renderStandaloneHtmlFromSource(this.settings, source, this.templates.layout()),
      );
    } catch (error) {
      return fail({ severity: "error", code: "md/render", message: (error as Error).message });
    }
  }
}
