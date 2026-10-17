# BACKLOG

Uncompleted items that remained after TODO.md was retired.

## Markdown and rendering
- [ ] `markdown.breaks` — add an option to allow single newlines to produce `<br>` in HTML. The guide hard-wraps prose and enabling `breaks` previously produced unwanted `<br>`s; if this is added, it should be opt-in under `markdown.breaks` (default off).

## Build and preview
- [ ] Output naming / pretty URLs — risky change to the web build's output layout. No configuration key yet.

## Architecture
- [ ] Finish the file-split refactoring: the planned split of `src/build-tex-book/parse.ts` into blocks, inlines, links, images, entities and state. `parse.ts` already keeps only `tokensToIr`, `parseChapter` and the mermaid drawing step; the remaining split should be done in small commits with no behaviour change.
