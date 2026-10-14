# geek-book — build the engine's own sample book.
#
#   just              build/html/ (the sample as a static website)
#   just pdf          build/book.pdf
#   just docker-book  build/html/ + build/book.pdf inside Docker
#   just serve        preview build/html/ on http://localhost:4000
#   just lint         type-check the engine, then lint the sample
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

# --- website -----------------------------------------------------------------

# build/html/ — the sample as a static website. Rebuilds only when a source is
# newer than the last build.
html:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -f "{{html}}/index.html" ]] && \
       [[ -z "$(find "{{book}}" -name '*.md' -newer "{{html}}/index.html" -print -quit)" ]] && \
       [[ -z "$(find src bin package.json -type f -newer "{{html}}/index.html" -print -quit)" ]]; then
        echo "html -> {{html}}/ (up to date)"
    else
        [[ -d node_modules ]] || "{{npm}}" install
        {{engine}} web "{{html}}"
    fi

# Static preview of the built site (no auto-rebuild). Rebuild first with `just`.
serve:
    {{engine}} serve "{{html}}" 4000

# --- pdf ---------------------------------------------------------------------

# build/book.pdf — the whole sample in one print-ready file, typeset with
# LuaLaTeX. Rebuilds only when a source changes.
pdf:
    #!/usr/bin/env bash
    set -euo pipefail
    [[ -d node_modules ]] || "{{npm}}" install
    if [[ -f "{{pdf}}" ]] && \
       [[ -z "$(find "{{book}}" \( -name '*.md' -o -name 'cover.jpg' \) \
                 -newer "{{pdf}}" -print -quit)" ]] && \
       [[ -z "$(find src bin package.json -type f -newer "{{pdf}}" -print -quit)" ]]; then
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

# --- checks -----------------------------------------------------------------

# type-check the engine, then lint the sample book.
lint:
    #!/usr/bin/env bash
    set -euo pipefail
    [[ -d node_modules ]] || "{{npm}}" install
    "{{npm}}" run lint

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
