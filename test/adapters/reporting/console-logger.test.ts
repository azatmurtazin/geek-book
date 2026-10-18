// The console adapter of the Logger port: one `info` call, one line. It never
// formats a severity — diagnostics are the Reporter's business.

import { describe, expect, it } from "vitest";
import { ConsoleLogger } from "../../../src/adapters/reporting/console-logger.js";

function capture(): { text: () => string; write: (chunk: string) => boolean } {
  let text = "";
  return {
    text: () => text,
    write: (chunk: string) => {
      text += chunk;
      return true;
    },
  };
}

describe("ConsoleLogger", () => {
  it("writes a message followed by a newline", () => {
    const stream = capture();
    new ConsoleLogger(stream).info("built the site");
    expect(stream.text()).toBe("built the site\n");
  });

  it("writes each call on its own line, and keeps empty lines", () => {
    const stream = capture();
    const logger = new ConsoleLogger(stream);
    logger.info("one");
    logger.info("");
    logger.info("two");
    expect(stream.text()).toBe("one\n\ntwo\n");
  });
});
