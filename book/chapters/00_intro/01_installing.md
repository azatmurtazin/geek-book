# Installing geek-book

*The engine, the toolchain it asks for, and the image that carries both.*

The website build needs nothing but Node.js — version 20 or newer — and one
`npm install` for the engine's dependencies. The printed edition adds three
programs the engine shells out to, and the Docker image bundles all of them so a
machine can build the PDF with no host setup at all.

## Install the engine

```sh
npm add azatmurtazin:geek-book
```

Or add into your `package.json`:

```json
{
  "dependencies": {
    "geek-book": "github:azatmurtazin/geek-book"
  }
}
```

## The print toolchain

The PDF build fails early and says what is missing. It wants:

- **LuaLaTeX** — the typesetting engine (MacTeX, TeX Live, or the Docker image).
- **rsvg-convert** — turns a diagram's SVG into a PDF figure (`librsvg`).
- **pdfinfo** — poppler; the engine reads a PDF's metadata, page count and size back.
- **The book's fonts** — the families `book.config.json` names have to be
  installed where the PDF is built; the defaults ship with the Docker image.

The engine's own Justfile reports which of these a machine has:

```sh
just install-tools
```

## The image

The engine's `docker/` directory builds an image with Node, LuaLaTeX and the
default fonts already in place. A book that copies the engine's compose service
gets a build that runs the same on any machine:

```sh
just docker-book
```

The image is also what the engine's own CI runs, so a change that breaks a book
build is caught the same way on a laptop and on a server.
