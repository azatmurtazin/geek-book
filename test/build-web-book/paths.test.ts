// The web build's two naming schemes and the hrefs that follow from them.
//
// `outputRelFor` is where a chapter lands; `pageHref` and `assetHref` are how
// one built page names another page or a file. The pairs that matter are the
// ones the two schemes answer differently — a sibling chapter, the home page, a
// page linking to itself — plus the assets, which are plain files under both.

import { describe, expect, it } from "vitest";
import { assetHref, outputRelFor, pageHref } from "../../src/build-web-book/paths.js";

describe("outputRelFor", () => {
  it("writes `<name>.html` by default", () => {
    expect(outputRelFor("chapters/01_start.md", false)).toBe("chapters/01_start.html");
    expect(outputRelFor("README.md", false)).toBe("README.html");
  });

  it("writes `<name>/index.html` with pretty URLs", () => {
    expect(outputRelFor("chapters/01_start.md", true)).toBe("chapters/01_start/index.html");
    expect(outputRelFor("README.md", true)).toBe("README/index.html");
  });

  it("matches the extension case-insensitively, as a title would", () => {
    expect(outputRelFor("chapters/01_start.MD", true)).toBe("chapters/01_start/index.html");
  });
});

describe("assetHref", () => {
  it("measures a plain file from the page's output directory", () => {
    expect(assetHref("chapters/01_start.html", "assets/style.css")).toBe("../assets/style.css");
    expect(assetHref("index.html", "assets/style.css")).toBe("assets/style.css");
  });

  it("measures from one directory deeper under pretty URLs", () => {
    expect(assetHref("chapters/01_start/index.html", "assets/style.css")).toBe("../../assets/style.css");
    expect(assetHref("chapters/01_start/index.html", "images/dot.png")).toBe("../../images/dot.png");
  });
});

describe("pageHref", () => {
  it("names the file between pages by default", () => {
    expect(pageHref("chapters/01_start.html", "chapters/02_more.html", false)).toBe("02_more.html");
    expect(pageHref("chapters/02_more.html", "chapters/01_start.html", false)).toBe("01_start.html");
    expect(pageHref("chapters/01_start.html", "index.html", false)).toBe("../index.html");
  });

  it("names the directory between pages with pretty URLs", () => {
    expect(pageHref("chapters/01_start/index.html", "chapters/02_more/index.html", true)).toBe("../02_more/");
    expect(pageHref("chapters/02_more/index.html", "chapters/01_start/index.html", true)).toBe("../01_start/");
  });

  it("reaches the home page from a nested one", () => {
    expect(pageHref("chapters/01_start/index.html", "index.html", true)).toBe("../../");
  });

  it("links a page to itself as ./ under pretty URLs", () => {
    expect(pageHref("chapters/01_start/index.html", "chapters/01_start/index.html", true)).toBe("./");
  });
});
