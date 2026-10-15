# Remote images

*Pictures the book cites with a URL rather than keeps.*

A source may be an `http(s)` URL, for a picture the book points at rather than
carries:

![A bird drawn in ASCII characters](https://upload.wikimedia.org/wikipedia/commons/9/96/Bird_converted_to_ASCII_characters.png)

The build fetches it once per run and both editions read that copy — the website
into `images/remote/`, the printed edition into `build/figures/`. The site ships
the picture with itself instead of sending the reader off to the origin, and the
print build embeds it like any other local file.

## What to know

A book that uses remote images needs the network to build, which is the one
thing to remember about them — and so do the pre-commit hook and CI, which build
the same book. The linter reports each remote source it finds, so the
requirement is visible rather than surprising.

A fetch that fails, or that answers with something other than an image, stops
the build with the URL. The printed edition can embed png and jpeg only; any
other format is refused with a message, since LaTeX cannot place it. The website
alone would accept more, but a book is built for both editions.
