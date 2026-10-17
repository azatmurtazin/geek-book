# BACKLOG

Uncompleted items from [TODO.md](./TODO.md), summarised as they are now.

## Markdown and rendering
- [ ] `markdown.breaks` — add an option to allow single newlines to produce `<br>` in HTML. The guide hard-wraps prose and enabling `breaks` previously produced unwanted `<br>`s; if this is added, it should be opt-in under `markdown.breaks` (default off). (TODO lines 109–113)

## Build and preview
- [ ] Output naming / pretty URLs — risky change to the web build's output layout. No configuration key yet. (TODO lines 147–148)

## Architecture (after test harness)
- [ ] Finish the file-split refactoring: the planned split of `src/build-tex-book/parse.ts` into blocks/inlines/links/images/entities/state is partially complete (parse.ts already keeps only `tokensToIr`, `parseChapter` and mermaid drawing). There are still a few final split commits to complete, with no behaviour change. (TODO lines 202–236, 280–285)
