// The `show-config` use case: the resolved settings as the `config` command
// prints them. The shape is the CLI's frozen surface, so this locks the pieces
// a reader (or the baseline) relies on.

import { describe, expect, it } from "vitest";
import { showConfig } from "../../../src/application/usecases/show-config.js";
import { fixtureConfig } from "../../helpers/config.js";

describe("showConfig", () => {
  const printed = JSON.parse(showConfig(fixtureConfig())) as Record<string, any>;

  it("shows the root as `.`, and every path relative to it", () => {
    expect(printed.root).toBe(".");
    expect(printed.configFile).toBe("book.config.json");
    expect(printed.bookDir).toBe("book");
    expect(printed.summary).toBe("book/SUMMARY.md");
    expect(printed.outputWeb).toBe("build/html");
    expect(printed.outputPdf).toBe("build/book.pdf");
    expect(printed.docs).toEqual(["README.md", "CONTRIBUTING.md"]);
  });

  it("carries the reader-facing settings through", () => {
    expect(printed.title).toBe("Fixture Book");
    expect(printed.version).toBe("1.2.3");
    expect(printed.placeholders).toEqual({ edition: "second" });
    expect(printed.languages).toContain("rust");
    expect(printed.code.rust).toEqual({ label: "Rust", comment: "slash" });
  });

  it("omits the internal pretty-URLs switch, as the CLI always has", () => {
    expect(printed.web.prettyUrls).toBeUndefined();
  });
});
