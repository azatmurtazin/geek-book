# Publishing

*Commands, checks, and the automation a book repo copies.*

A book is finished when it builds clean and both editions are in place. The
engine's commands are small and composable, the linter checks the sources before
either edition is built, and the templates a book repo copies wire all of it
into pre-commit hooks and CI.

## In this section

- [Commands](01_commands.md) — the full command line.
- [Linting](02_lint.md) — the four families of check, and what each catches.
- [Continuous integration](03_ci.md) — templates, Docker and releases.
