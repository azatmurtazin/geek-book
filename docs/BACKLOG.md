# BACKLOG

Uncompleted items that remained after TODO.md was retired.

## Build and preview
- [ ] Output naming / pretty URLs — risky change to the web build's output layout. No configuration key yet.

## Architecture
- [ ] Finish the file-split refactoring: the planned split of `src/build-tex-book/parse.ts` into blocks, inlines, links, images, entities and state. `parse.ts` already keeps only `tokensToIr`, `parseChapter` and the mermaid drawing step; the remaining split should be done in small commits with no behaviour change.
