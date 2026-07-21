<!-- schemd-doc: id=output-modes; label=Output modes; title=Choose the smallest truthful SVG mode; summary=Static output, embedded theme CSS, and full semantic hooks share identical geometry.; category=Ship output; order=60 -->

<!-- schemd-section: id=modes; eyebrow=01 / Output; title=Separate geometry from interaction payload; example-title=Mode-parity specimen -->

| Mode           | Adds                                                 | Use it for                                     |
| -------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `default`      | Accessible static SVG only                           | articles, email-safe exports, immutable assets |
| `embedded-css` | isolated theme and state classes                     | responsive themed documents                    |
| `full`         | node, port, wire, source-line, and topology datasets | playground mapping and simulations             |

All modes use the same parsed document, layout, routes, vectors, and viewBox. Raw SVG in the playground is the exact string used by Render View—not a reconstructed DOM snapshot.

With wire hooks enabled, every signal wire exposes its parser-resolved topology as `data-net-id`: named nets keep their author name and unnamed nets use deterministic `$N` identities. The compilation source map exposes the same value as `SchematicWireSource.netId`; relation-only UML connectors omit it.

```schemd bounds="760x320" title="Mode-parity specimen"
source:S "pulse" at (90, 130) #blue [type=voltage-pulse]
switch:SW "SPST" at (290, 130) #amber [type=spst]
load:M "motor" at (520, 130) #emerald [type=motor]
S.positive -> SW.in #blue [line]
SW.out -> M.in #emerald [line]
```

`full` mode keeps diagram-local IDs and provides accessible port targets. It never injects scripts, external fonts, raster assets, data URLs, or `foreignObject`.

<!-- /schemd-section -->

<!-- schemd-section: id=optimization; eyebrow=02 / Bytes; title=Reuse canonical symbols; example-title=Repeated passives -->

Repeated identical components reference one `<symbol>` definition. Orientation adds only an instance rotation; unused families add zero bytes to an individual generated diagram.

```schemd bounds="820x300" title="Repeated passives"
resistor:R1 "R" at (130, 120) #amber
resistor:R2 "R" at (350, 120) #amber [orientation=down]
resistor:R3 "R" at (580, 120) #amber [orientation=left]
```

<!-- /schemd-section -->
