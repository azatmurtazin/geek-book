// Paths and anchors the engine agrees on, as branded strings.
//
// A `BookPath` is relative to the book directory and uses forward slashes; an
// `OutputPath` is where a build writes; a `SourcePath` is where a build reads.
// An `Anchor` is a heading id. They are all strings at runtime — the brand only
// stops one from being handed to a function that wants another, and marks the
// few places that must convert (an adapter reading the disk, splitting a path).
//
// Pure: part of `domain/`, imports nothing outside `domain/`.

/** A path relative to the book directory, forward-slashed. */
export type BookPath = string & { readonly __brand: "BookPath" };

/** A path a build writes, absolute or output-relative. */
export type OutputPath = string & { readonly __brand: "OutputPath" };

/** A path a build reads, absolute or book-relative. */
export type SourcePath = string & { readonly __brand: "SourcePath" };

/** A heading id, as both editions emit it. */
export type Anchor = string & { readonly __brand: "Anchor" };

export const bookPath = (value: string): BookPath => value as BookPath;
export const outputPath = (value: string): OutputPath => value as OutputPath;
export const sourcePath = (value: string): SourcePath => value as SourcePath;
export const anchor = (value: string): Anchor => value as Anchor;
