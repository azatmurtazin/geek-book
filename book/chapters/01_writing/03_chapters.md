# Chapters

*One title per file, and the rules that make a chapter a chapter.*

A chapter is one `.md` file. The engine treats it as a page of the website and a
section of the printed book, and it expects the file to look like one: a single
title, then the prose beneath it.

## Exactly one title

Every chapter opens with its `# Title` — the first line of the file — and has no
other `#` heading. The engine uses that line as the page's title, and the
printed edition uses it as the chapter heading. A file that opens with a `##`
heading, or that carries two `#` titles, fails the linter before either edition
is built.

Headings below the title nest as usual: `##` for a section, `###` for a
subsection, and so on, with no skipped level — an `###` may not follow an `#`
directly.

## Linking

A link to another chapter is a path relative to the file that carries it:

```md
[Installing](01_installing.md)
```

The linter resolves it offline and fails the build if the target does not exist.
A link to a heading is an anchor on the same file or another:

```md
Back to [the tree](01_tree.md#the-book-tree).
```

An anchor is the heading lower-cased, with punctuation removed and spaces turned
into hyphens; that is also the id the website emits, so the same link lands on
the same heading in both editions.

## Placeholders

One build-time placeholder may appear in the prose: the book's version, written
as a `version` token between double braces. It is filled the same way in both
editions, so a page that cites its own edition reads correctly everywhere:

```md
This is the {{ version }} edition of the guide.
```

Placeholders are never touched inside a fenced block, so a code sample that
carries `{{ … }}` of its own — a Go template, a JSX expression — is left exactly
as it was written.
