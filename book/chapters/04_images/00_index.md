# Images

*Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.*

A picture is written the way Markdown always writes one, and its source is
either absolute inside the book or relative to the file that carries it:

```md
![A developer at a keyboard](/images/developer.jpg)
```

![A developer at a keyboard](/images/developer.jpg)

Both editions resolve it. The website copies the file into the output tree and
rewrites `src` to a path relative to the page, so a chapter nested any depth
deep still finds its pictures. The print build scales the image to fit inside
the text block — `keepaspectratio` does the arithmetic — and a portrait
photograph and a landscape one land on the page by the same rule.

The linter checks that the file is there, and refuses a source that climbs out
of the book directory: the web build mirrors the book tree, so an image living
outside it has nowhere to go. A source may also be a URL, which the build
fetches before either edition reads it. [A photograph](01_photograph.md) shows
the other local spelling, and [a remote picture](02_remote.md) the fetched one.
