# schemd brand assets

The mark is one net routed as a lowercase s, with a terminal at each end. Its middle run is yellow-lined, the way a checker marks a net once it has been traced on a drawing. It belongs to the Vellum design described in `DESIGN.md`.

- `schemd-mark.svg` is the square mark for avatars and compact places.
- `schemd-logo.svg` is the horizontal lockup, the mark beside the wordmark. The wordmark is Atkinson Hyperlegible Next at weight 800, tracked −0.035em, converted to outlines so the file needs no font.
- `previews/` holds PNG renders of both for places that cannot show SVG.

Both SVG files switch to the Light table colours when the viewer prefers a dark scheme. The site draws the same mark with its own colour tokens in `src/lib/components/Mark.svelte`; the favicons in `static/` are the same drawing with heavier strokes, and the 16 px icon inside `favicon.ico` drops the terminal rings so it stays legible.

| Colour      | Day       | Light table |
| ----------- | --------- | ----------- |
| Sheet       | `#F6F8FB` | `#252F3D`   |
| Ink         | `#14213D` | `#E6ECF4`   |
| Highlighter | `#FFE45C` | `#E8C93A`   |

Keep clear space of one terminal diameter round the mark. Do not recolour the net or the highlighter, and do not stretch either file.
