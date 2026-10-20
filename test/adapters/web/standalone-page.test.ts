// The Markdown → HTML pipeline: `renderBody` (the chapter body) and
// `renderStandaloneHtml` (the body wrapped in the standalone layout, read from
// the template store). Both take the book settings, so the fixture under
// `test/fixtures/minimal/` stands in for a real book and the engine's own
// config is never read.

import { describe, expect, it } from "vitest";
import {
  highlightComments,
  renderBody,
  renderStandaloneHtml,
} from "../../../src/adapters/web/standalone-page.js";
import { AssetTemplateStore } from "../../../src/adapters/templates/asset-template-store.js";
import type { BookSettings } from "../../../src/application/settings.js";
import { slugify } from "../../../src/domain/values/anchor.js";
import { smartTypography } from "../../../src/domain/values/smart-typography.js";
import { fixtureConfig } from "../../helpers/config.js";

const cfg = fixtureConfig();
const layout = new AssetTemplateStore().layout();

describe("renderBody — headings", () => {
  it("gives a heading a slug id, at any depth", () => {
    expect(renderBody(cfg, "# Hello, World!")).toContain('<h1 id="hello-world">Hello, World!</h1>');
    expect(renderBody(cfg, "## Sub Section")).toContain('<h2 id="sub-section">Sub Section</h2>');
  });

  it("uses the slugifier the linter shares, so anchors and checks agree", () => {
    expect(renderBody(cfg, "## C++ & AT&T")).toContain(`id="${slugify("C++ & AT&T")}"`);
  });
});

describe("renderBody — line breaks", () => {
  it("keeps single newlines soft, so hard-wrapped prose gets no <br>", () => {
    const html = renderBody(cfg, "one line\nwrapped here");
    expect(html).toBe("<p>one line\nwrapped here</p>\n");
    expect(html).not.toContain("<br>");
  });

  it("still honours an explicit GFM hard break (two trailing spaces)", () => {
    expect(renderBody(cfg, "one line  \nforced")).toContain("<br>");
  });

  it("breaks a single newline when the book asks for it", () => {
    const broken: BookSettings = { ...cfg, markdown: { ...cfg.markdown, breaks: true } };
    expect(renderBody(broken, "one line\nwrapped here")).toBe("<p>one line<br>wrapped here</p>\n");
  });

  it("still honours a GFM hard break with the key on", () => {
    const broken: BookSettings = { ...cfg, markdown: { ...cfg.markdown, breaks: true } };
    expect(renderBody(broken, "one line  \nforced")).toContain("<br>");
  });

  it("renders GFM tables, lists and strikethrough", () => {
    expect(renderBody(cfg, "| a | b |\n| --- | --- |\n| 1 | 2 |")).toContain("<table>");
    expect(renderBody(cfg, "- one\n- two")).toContain("<ul>");
    expect(renderBody(cfg, "~~gone~~")).toContain("<del>gone</del>");
  });
});

describe("renderBody — code fences", () => {
  it("tags the fence language on <code>", () => {
    expect(renderBody(cfg, "```js\nlet x = 1;\n```")).toContain('<code class="language-js">');
  });

  it("escapes the language tag", () => {
    expect(renderBody(cfg, "```a<b\nx\n```")).toContain('class="language-a&lt;b"');
  });

  it("shows the book's own label chip for a configured language", () => {
    const html = renderBody(cfg, "```rust\nfn main() {}\n```");
    expect(html).toContain('<div class="code-block">');
    expect(html).toContain('<span class="code-label">Rust</span>');
  });

  it("wraps a slash comment in a span and escapes the code", () => {
    const html = renderBody(cfg, "```rust\n// a comment\nlet a = 1 < 2;\n```");
    expect(html).toContain('<span class="code-comment">// a comment</span>');
    expect(html).toContain("let a = 1 &lt; 2;");
  });

  it("leaves a language with no known label bare", () => {
    expect(renderBody(cfg, "```text\nplain\n```")).not.toContain("code-block");
  });
});

describe("renderBody — smart typography", () => {
  /** A config that turns the key on; the fixture itself keeps it off. */
  const smart: BookSettings = { ...cfg, markdown: { ...cfg.markdown, smartTypography: true } };

  it("is off by default, straight and flat", () => {
    expect(renderBody(cfg, 'a "b" -- c')).toContain('a &quot;b&quot; -- c');
  });

  it("curls quotes and dashes when the book asks", () => {
    expect(renderBody(smart, 'a "b" -- c')).toContain("a \u201cb\u201d \u2013 c");
    expect(renderBody(smart, "a---b")).toContain("a\u2014b");
  });

  it("pairs a quote that wraps emphasis", () => {
    expect(renderBody(smart, '"**bold**"')).toContain("\u201c<strong>bold</strong>\u201d");
  });

  it("leaves code and link targets alone", () => {
    const html = renderBody(smart, '`"x"` and ["y"](https://example.com/a--b)');
    expect(html).toContain("<code>&quot;x&quot;</code>");
    expect(html).toContain('href="https://example.com/a--b"');
    expect(html).toContain("\u201cy\u201d");
  });

  it("keys heading ids off the smartened text, as the linter does", () => {
    // `--` folds to an en dash, which the slug drops, so the id keeps two dashes.
    expect(renderBody(smart, "## A -- B")).toContain('<h2 id="a--b">A \u2013 B</h2>');
  });

  it("gives a heading the linter's id, even around a code span", () => {
    const line = "The `--config` flag";
    const id = slugify(smartTypography(line));
    expect(id).toBe("the---config-flag");
    expect(renderBody(smart, `## ${line}`)).toContain(`<h2 id="${id}">`);
  });
});

describe("highlightComments", () => {
  it("returns the escaped code byte-for-byte when the language has no comments", () => {
    expect(highlightComments("let a = 1 < 2;", "text", cfg.code)).toBe("let a = 1 &lt; 2;");
  });
});

describe("renderBody — placeholders", () => {
  it("substitutes the built-in and book tokens in prose", () => {
    const html = renderBody(cfg, "Version {{ version }} of {{ title }}, {{ edition }} edition.");
    expect(html).toContain("Version 1.2.3 of Fixture Book, second edition.");
  });

  it("leaves a token inside a fence byte-for-byte", () => {
    expect(renderBody(cfg, "```text\n{{ version }}\n```")).toContain("{{ version }}");
  });

  it("passes an unknown token through", () => {
    expect(renderBody(cfg, "{{ nope }}")).toContain("{{ nope }}");
  });
});

describe("renderStandaloneHtml — the page", () => {
  it("takes the <title> from the first H1", () => {
    expect(renderStandaloneHtml(cfg, "# My Chapter\n\nbody", layout)).toContain(
      "<title>My Chapter — Fixture Book</title>",
    );
  });

  it("falls back to the book title when there is no H1", () => {
    expect(renderStandaloneHtml(cfg, "just prose", layout)).toContain("<title>Fixture Book</title>");
  });

  it("strips inline markup from the title", () => {
    expect(renderStandaloneHtml(cfg, "# Use `code` and *emphasis*", layout)).toContain(
      "<title>Use code and emphasis — Fixture Book</title>",
    );
  });

  it("fills every layout slot", () => {
    const html = renderStandaloneHtml(cfg, "# T\n\nbody", layout);
    expect(html).not.toMatch(/\{\{\s*[a-z-]+\s*\}\}/);
    expect(html).toContain('lang="en"');
  });

  it("escapes the tagline and the book title", () => {
    const special: BookSettings = { ...cfg, title: "A & B", tagline: "a & b <script>" };
    const html = renderStandaloneHtml(special, "# T", layout);
    expect(html).toContain("a &amp; b &lt;script&gt;");
    expect(html).toContain("<span>A &amp; B</span>");
  });

  it("escapes the page title in <title>", () => {
    const html = renderStandaloneHtml(cfg, "# A & B <script>", layout);
    expect(html).toContain("<title>A &amp; B &lt;script&gt; — Fixture Book</title>");
  });
});
