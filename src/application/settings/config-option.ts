// The `--config` option: which file names the book, and the conventional name.
//
// A book is normally the directory the CLI runs from, where `book.config.json`
// is read; naming a config builds the book beside that file instead, so one
// checkout can build another without changing directory. Pulling the option out
// of `argv` is pure, so it lives here rather than in the composition root.

/** The config file's conventional name, at the root the CLI runs from. */
export const CONFIG_FILE = "book.config.json";

/**
 * The `--config` option pulled out of `argv`, wherever on the line it sits,
 * written `--config <file>` or `--config=<file>`.
 */
export interface ConfigOption {
  /** The named config file, or null when `--config` is absent. */
  file: string | null;
  /** True when `--config` was written with no file after it. */
  missingValue: boolean;
  /** `argv` with the option removed, for the chosen command to parse. */
  argv: string[];
}

/** Read the `--config` option from `argv` and hand back the rest. */
export function takeConfigOption(argv: string[]): ConfigOption {
  const rest: string[] = [];
  let file: string | null = null;
  let missingValue = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--config") {
      const value = argv[i + 1];
      // A following flag is not a filename, so the option has no value.
      if (value === undefined || value.startsWith("-")) {
        missingValue = true;
      } else {
        file = value;
        i += 1;
      }
    } else if (arg.startsWith("--config=")) {
      const value = arg.slice("--config=".length);
      if (value === "") missingValue = true;
      else file = value;
    } else {
      rest.push(arg);
    }
  }
  return { file, missingValue, argv: rest };
}
