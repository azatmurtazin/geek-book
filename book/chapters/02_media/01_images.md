# Images

*Local pictures, written the way Markdown writes them.*

A picture is an `![alt](source)`. The source is either absolute inside the book
or relative to the file that carries it, and both editions resolve it:

```md
![A developer at a keyboard](/images/developer.jpg)
```

![A developer at a keyboard](/images/developer.jpg)

The spelling above counts from the book root. The spelling below counts from the
file's own directory, climbing to `book/images/`:

```md
![A software lifecycle, drawn wide](../../images/sdlc.jpeg)
```

![A software lifecycle, drawn wide](../../images/sdlc.jpeg)

Both end up in `book/images/`, and the linter checks that the file is there. A
source that climbs out of the book directory is an error: the web build mirrors
the book tree into the output directory, so a picture living outside it has
nowhere to land.

## What each edition does

The website copies the file in beside the page and rewrites `src`, so a chapter
nested any depth deep still finds its pictures. The print build embeds the image
at the size the site gives it — 96 pixels to the inch — shrinking it to the text
block only when it would not fit, so a small picture is never stretched across
the page.

## Formats

The website copies the file and lets the browser draw it, so any format a
browser renders works there. The print build hands the file to LaTeX instead,
which reads png and jpeg from disk — a pdf page embeds too, but a browser draws
it as nothing.

A book built for both editions therefore keeps its pictures png or jpeg, the two
formats both editions read. Nothing checks the extension, so an svg or webp
passes the linter and the website and fails only when the PDF is built. A
drawing that must survive both is a [diagram](03_diagrams.md), not a file.

## Copies are shared

Repeating a picture is cheap. The engine copies each distinct source once per
chapter and reuses the copy, so an image referenced twice is stored once.
