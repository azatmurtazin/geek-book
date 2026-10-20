// The engine's own templates, read off disk: the standalone layout, the two
// stylesheets and the LaTeX preamble, plus a book's optional `web.css` and
// `web.head`.
//
// The engine files are located relative to this module (`import.meta.url`), so
// the store works wherever the package is installed; a book's own files are read
// from the absolute path the settings resolved. Each plain asset sits beside its
// reader: the layout here, the stylesheets under `render-html/` and `web/`, and
// the LaTeX preamble under `render-tex/`.

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { TemplateStore } from "../../application/ports/template-store.js";

/** The engine asset `name`, resolved beside this module. */
function asset(name: string): string {
  return fs.readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
}

/** A stylesheet, trimmed the way the built-in ones always were. */
function stylesheet(name: string): string {
  return asset(name).trim();
}

/** A book's own file, trimmed; "" when the config names none. */
function bookFile(path: string): string {
  return path ? fs.readFileSync(path, "utf8").trim() : "";
}

export class AssetTemplateStore implements TemplateStore {
  layout(): string {
    return asset("default-layout.html");
  }

  contentCss(): string {
    return stylesheet("../render-html/content.css");
  }

  siteCss(): string {
    return stylesheet("../web/site.css");
  }

  texPreamble(): string {
    return asset("../render-tex/preamble.tex");
  }

  bookCss(path: string): string {
    return bookFile(path);
  }

  headHtml(path: string): string {
    return bookFile(path);
  }
}
