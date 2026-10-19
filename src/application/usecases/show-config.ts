// The `config` command's use case: the resolved settings, as JSON.
//
// What a book prints is its settings with every absolute path shown relative to
// the book root, so the same book reads the same on any machine. The shape is
// frozen — it is part of the CLI's surface and a baseline artifact — so the
// field order and the omission of `web.prettyUrls` (an internal switch) match
// the output the command has always written.

import { relative } from "../../domain/values/posix-path.js";
import type { BookSettings } from "../settings.js";

/** A path the printed config shows relative to the book root, or ".". */
function rel(root: string, target: string): string {
  return relative(root, target) || ".";
}

/** The settings as the `config` command prints them. */
export function showConfig(settings: BookSettings): string {
  return JSON.stringify(
    {
      root: ".",
      configFile: rel(settings.root, settings.configFile),
      title: settings.title,
      tagline: settings.tagline,
      author: settings.author,
      version: settings.version,
      placeholders: settings.placeholders,
      language: settings.language,
      strings: settings.strings,
      bookDir: rel(settings.root, settings.bookDir),
      summary: rel(settings.root, settings.summary),
      chapters: rel(settings.root, settings.chapters),
      readme: rel(settings.root, settings.readme),
      cover: rel(settings.root, settings.cover),
      outputWeb: rel(settings.root, settings.outputWeb),
      outputPdf: rel(settings.root, settings.outputPdf),
      outputClean: settings.outputClean,
      docs: settings.docs.map((doc) => rel(settings.root, doc)),
      diagrams: settings.diagrams,
      fonts: settings.fonts,
      web: {
        css: settings.web.css ? rel(settings.root, settings.web.css) : "",
        head: settings.web.head ? rel(settings.root, settings.web.head) : "",
        baseUrl: settings.web.baseUrl,
        description: settings.web.description,
        favicon: settings.web.favicon ? rel(settings.root, settings.web.favicon) : "",
        links: settings.web.links,
      },
      tex: {
        geometry: settings.tex.geometry,
        colors: settings.tex.colors,
        type: settings.tex.type,
        class: settings.tex.class,
        side: settings.tex.side,
        tocDepth: settings.tex.tocDepth,
        titlePage: settings.tex.titlePage,
        copyright: settings.tex.copyright,
        isbn: settings.tex.isbn,
        preamble: settings.tex.preamble ? rel(settings.root, settings.tex.preamble) : "",
      },
      languages: [...settings.languages],
      code: settings.code,
      images: settings.images,
      lint: settings.lint,
      markdown: settings.markdown,
      serve: settings.serve,
    },
    null,
    2,
  );
}
