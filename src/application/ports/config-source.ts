// The ConfigSource port: the raw JSON a book is configured by.
//
// It hands back the parsed `book.config.json` and the book's `package.json`,
// unread and unvalidated — turning them into `BookSettings` is a pure use case
// (`application/usecases/load-settings.ts`), so the file finding is here and the
// meaning is there (see `adapters/config/file-config-source.ts`).

export interface ConfigSource {
  read(): RawConfig;
}

/** The config and package metadata, exactly as they were on disk. */
export interface RawConfig {
  /** The book root: the directory paths inside the config resolve against. */
  readonly root: string;
  /** The config file read, absolute; it may not exist. */
  readonly configFile: string;
  /** The parsed `book.config.json`, or null when it is absent or unreadable. */
  readonly value: unknown;
  /** The parsed `package.json`, or null when it is absent or unreadable. */
  readonly packageValue: unknown;
}
