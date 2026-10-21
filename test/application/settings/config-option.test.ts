// The `--config` option, pulled out of argv before a command sees it.
//
// The parser is pure, so the cases are the whole contract: the two spellings,
// the option anywhere on the line, a flag in the value's place, and the rest of
// argv coming back in order.

import { describe, expect, it } from "vitest";
import { takeConfigOption } from "../../../src/application/settings/config-option.js";

describe("takeConfigOption", () => {
  it("leaves argv alone when the option is absent", () => {
    const argv = ["web", "build/html"];
    expect(takeConfigOption(argv)).toEqual({ file: null, missingValue: false, argv });
  });

  it("takes `--config <file>` from anywhere on the line", () => {
    expect(takeConfigOption(["--config", "other.json", "pdf", "out.pdf"])).toEqual({
      file: "other.json",
      missingValue: false,
      argv: ["pdf", "out.pdf"],
    });
    expect(takeConfigOption(["web", "--config", "other.json", "build/html"])).toEqual({
      file: "other.json",
      missingValue: false,
      argv: ["web", "build/html"],
    });
  });

  it("takes `--config=<file>`, including a path with a dash", () => {
    expect(takeConfigOption(["--config=books/a-b/book.config.json", "lint"])).toEqual({
      file: "books/a-b/book.config.json",
      missingValue: false,
      argv: ["lint"],
    });
  });

  it("reports a missing value at the end, with or without `=`", () => {
    expect(takeConfigOption(["web", "--config"])).toEqual({
      file: null,
      missingValue: true,
      argv: ["web"],
    });
    expect(takeConfigOption(["--config=", "web"])).toEqual({
      file: null,
      missingValue: true,
      argv: ["web"],
    });
  });

  it("does not take a following flag as the file", () => {
    expect(takeConfigOption(["--config", "--help"])).toEqual({
      file: null,
      missingValue: true,
      argv: ["--help"],
    });
  });

  it("keeps the last file when the option is given twice", () => {
    expect(takeConfigOption(["--config", "a.json", "web", "--config=b.json"])).toEqual({
      file: "b.json",
      missingValue: false,
      argv: ["web"],
    });
  });
});
