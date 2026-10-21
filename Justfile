# geek-book — build the engine's own user's guide.
#
#   just              build/html/ (the guide as a static website)
#   just pdf          build/book.pdf
#   just docker-book  build/html/ + build/book.pdf inside Docker
#   just serve        preview build/html/ on http://localhost:4000
#   just lint         type-check the engine, lint the guide, check boundaries
#   just test         run the unit tests
#   just boundaries   check the architectural boundary rules
#   just verify       rebuild and diff against the reference baseline
#   just release 0.1.6  bump, refresh the baseline, tag and push a release
#   just clean        remove build/
#   just install-tools  report the toolchain
#
# The engine is TypeScript run through tsx, so only Node.js + `npm install` are
# needed for the website; the PDF also wants LuaLaTeX and rsvg-convert.
#
# Overridable:  just --set build-dir out --set pdf out.pdf

build-dir := env_var_or_default("BUILD", "build")
pdf := env_var_or_default("PDF", "build/book.pdf")
node := env_var_or_default("NODE", "node")
npm := env_var_or_default("NPM", "npm")

book := "book"
html := build-dir + "/html"
engine := node + " bin/geek-book.mjs"

# default action is `list`
default: list

# list all available commands
list:
  @just --list

# Make sure the host install is complete. A fresh Docker volume starts with
# production dependencies only (the image's `npm ci --omit=dev`); the recipes
# that type-check or test need the dev tools too, so check for one of them
# rather than merely for the directory.
[private]
deps:
    #!/usr/bin/env bash
    set -euo pipefail
    [[ -x node_modules/.bin/tsc && -x node_modules/.bin/tsx ]] || "{{npm}}" install

# --- website -----------------------------------------------------------------

# build/html/ — the guide as a static website. Rebuilds when any book file,
# the book's config or the engine is newer than the last build.
html: deps
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -f "{{html}}/index.html" ]] && \
       [[ -z "$(find "{{book}}" book.config.json package.json src bin \
                 -type f -newer "{{html}}/index.html" -print -quit)" ]]; then
        echo "html -> {{html}}/ (up to date)"
    else
        {{engine}} web "{{html}}"
    fi

# Static preview of the built site (no auto-rebuild). Rebuild first with `just`.
serve:
    {{engine}} serve "{{html}}" 4000

# --- pdf ---------------------------------------------------------------------

# build/book.pdf — the whole book in one print-ready file, typeset with
# LuaLaTeX. Rebuilds when any book file, the book's config or the engine is
# newer than the last build.
pdf: deps
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -f "{{pdf}}" ]] && \
       [[ -z "$(find "{{book}}" book.config.json package.json src bin \
                 -type f -newer "{{pdf}}" -print -quit)" ]]; then
        echo "pdf -> {{pdf}} (up to date)"
    else
        {{engine}} pdf "{{pdf}}"
        echo "pdf -> {{pdf}}"
    fi

# --- docker ------------------------------------------------------------------

# build/html/ and build/book.pdf in the "book" Docker image (a Linux toolchain
# with no host setup). Builds the image first when needed.
docker-book:
    docker compose run --rm --build book

# --- baseline ----------------------------------------------------------------

# capture the reference baseline under test/baseline/ (canonical: in the book
# image, via `just docker-baseline`, so poppler and fonts do not drift). The
# build starts clean, so a stale timestamp can never enter the reference.
baseline:
    #!/usr/bin/env bash
    set -euo pipefail
    just clean
    just html
    just pdf
    "{{node}}" tools/baseline/baseline.mjs capture test/baseline

# capture the baseline inside the pinned book image — the reproducible reference
docker-baseline:
    docker compose run --rm --build book /bin/sh -c \
        'just clean && just html && just pdf && node tools/baseline/baseline.mjs capture test/baseline'

# rebuild both editions from a clean build and diff them against the committed
# baseline. The clean step makes the check authoritative: the timestamp checks
# in html/pdf are a convenience for editing, not evidence for verification. The
# two PDF artifacts are compared only inside the book image (poppler/font drift).
verify:
    #!/usr/bin/env bash
    set -euo pipefail
    just clean
    just html
    just pdf
    scratch="{{build-dir}}/baseline-check"
    rm -rf "$scratch"
    "{{node}}" tools/baseline/baseline.mjs capture "$scratch"
    "{{node}}" tools/baseline/baseline.mjs compare test/baseline "$scratch"

# report the architectural boundary rules. They are errors: a violation fails.
boundaries: deps
    #!/usr/bin/env bash
    set -euo pipefail
    npx --no-install depcruise src

# --- checks -----------------------------------------------------------------

# type-check the engine, lint the guide, then check the architectural
# boundaries (the rule set in .dependency-cruiser.cjs).
lint: deps
    #!/usr/bin/env bash
    set -euo pipefail
    "{{npm}}" run lint
    just boundaries

# run the unit tests: the domain, the use cases, the adapters and the
# cross-pipeline parity suite.
test: deps
    #!/usr/bin/env bash
    set -euo pipefail
    "{{npm}}" run test

# the same suite with a coverage report (coverage/index.html) and the floors
# from vitest.config.ts
coverage: deps
    #!/usr/bin/env bash
    set -euo pipefail
    "{{npm}}" run test:coverage

# --- releasing --------------------------------------------------------------

# Cut a release. The changelog must already carry the version's section
# (`## [0.1.6] — 2026-10-21`) and its row in the table; everything else is
# mechanical: a clean `main`, the bump, the baseline in the pinned image, a
# verify there, then a commit, an annotated tag and both pushes. The tag's
# workflow builds and publishes; nothing is published from here.
release version:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! "{{version}}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "release: version must look like 1.2.3, got '{{version}}'" >&2
        exit 1
    fi
    if [[ "$(git branch --show-current)" != "main" ]]; then
        echo "release: cut releases from main" >&2
        exit 1
    fi
    if [[ -n "$(git status --porcelain)" ]]; then
        echo "release: the working tree must be clean" >&2
        exit 1
    fi
    if git rev-parse -q --verify "refs/tags/v{{version}}" >/dev/null; then
        echo "release: tag v{{version}} already exists" >&2
        exit 1
    fi
    if ! grep -Fq "## [{{version}}] — " changelog.md; then
        echo "release: add a '## [{{version}}] — <date>' section to changelog.md first" >&2
        exit 1
    fi

    "{{npm}}" version "{{version}}" --no-git-tag-version
    just docker-baseline
    docker compose run --rm book just verify

    git --no-pager diff --stat test/baseline
    git add package.json package-lock.json changelog.md test/baseline
    git commit -m "Release {{version}}."
    git tag -a "v{{version}}" -m "geek-book {{version}}"
    git push origin main
    git push origin "v{{version}}"

# --- housekeeping -----------------------------------------------------------

# cleaning up
clean:
    rm -rf "{{build-dir}}"
    echo "clean -> removed {{build-dir}}/"

# install / report the required tools
install-tools:
    #!/usr/bin/env bash
    set -euo pipefail
    printf 'required\n'
    for t in "{{node}}" "{{npm}}"; do
        if command -v "$t" >/dev/null 2>&1; then
            printf '  %-12s %s\n' "$t" "$($t --version 2>&1 | head -1)"
        else
            printf '  %-12s MISSING\n' "$t"
        fi
    done
    printf '\noptional\n'
    printf '  lualatex      typesets build/book.pdf (install MacTeX or TeX Live)\n'
    printf '  rsvg-convert  mermaid figures in the PDF (brew install librsvg)\n'
    printf '  pdfinfo       poppler; PDF page count (brew install poppler)\n'
    printf '  pre-commit    git hooks: lint + build on commit (pipx install pre-commit)\n'
