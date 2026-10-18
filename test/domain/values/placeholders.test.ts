// `substitute`, moved from lib/content-placeholders.ts: the `{{ … }}` rule,
// now over a caller-supplied map.

import { describe, expect, it } from "vitest";
import { substitute } from "../../../src/domain/values/placeholders.js";

const map = { title: "Fixture Book", version: "1.2.3", empty: "" };

describe("substitute", () => {
  it("fills a known token, with or without inner spaces", () => {
    expect(substitute(map, "{{ title }} v{{version}}")).toBe("Fixture Book v1.2.3");
  });

  it("leaves an unknown token as written", () => {
    expect(substitute(map, "{{ nope }} and {{.}}")).toBe("{{ nope }} and {{.}}");
  });

  it("substitutes an empty value for an empty string", () => {
    expect(substitute(map, "x{{ empty }}y")).toBe("xy");
  });

  it("leaves fenced code byte-for-byte", () => {
    const source = ["before {{ title }}", "```go", "{{ title }}", "```", "after {{ title }}"].join("\n");
    expect(substitute(map, source)).toBe(
      ["before Fixture Book", "```go", "{{ title }}", "```", "after Fixture Book"].join("\n"),
    );
  });

  it("toggles fences with backticks or tildes", () => {
    expect(substitute(map, "~~~\n{{ title }}\n~~~\n{{ title }}")).toBe("~~~\n{{ title }}\n~~~\nFixture Book");
  });
});
