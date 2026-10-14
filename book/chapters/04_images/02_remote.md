# A remote picture

*Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.*

A source can also be a URL, for a picture the book cites rather than keeps:

![A bird drawn in ASCII characters](https://upload.wikimedia.org/wikipedia/commons/9/96/Bird_converted_to_ASCII_characters.png)

The build fetches it once per run into the build directory — `build/figures/`
for the print edition, `images/remote/` in the website — and both editions then
read that copy. The website carries the picture with it instead of sending the
reader off to Wikimedia, and the print build embeds it like any other.

A book that uses remote images needs the network to build, which is the one
thing to know about them. A fetch that fails, or that answers with something
other than an image, stops the build with the URL; a format the printed edition
cannot embed (anything but png and jpeg) stops it too. The linter reports what
will be fetched, so none of this arrives as a surprise.

Back to [Images](00_index.md).
