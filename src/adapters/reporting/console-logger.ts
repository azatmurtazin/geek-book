// The console implementation of the Logger port.
//
// One `info` call, one line. The stream is injected: progress goes to stdout in
// the composed CLI, while the CLI's own usage/help text stays on stderr.

import type { Logger } from "../../application/ports/logger.js";
import type { Writable } from "./console-reporter.js";

export class ConsoleLogger implements Logger {
  constructor(private readonly stream: Writable) {}

  info(message: string): void {
    this.stream.write(`${message}\n`);
  }
}
