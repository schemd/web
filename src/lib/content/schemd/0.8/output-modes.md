<!-- schemd-doc: id=output-modes; label=Output modes; title=Choose the smallest truthful SVG mode; summary=Static output, embedded theme CSS, and full semantic hooks share identical geometry.; category=Ship output; order=60 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate emitted markup, not connectivity. -->

<!-- schemd-section: id=modes; eyebrow=01 / Output; title=Separate geometry from interaction payload; example-title=Mode-parity specimen -->

| Mode           | Adds                                                 | Use it for                                     |
| -------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `default`      | Accessible static SVG only                           | articles, email-safe exports, immutable assets |
| `embedded-css` | isolated theme and state classes                     | responsive themed documents                    |
| `full`         | node, port, wire, source-line, and topology datasets | playground mapping and simulations             |

Here is the reassuring part: every mode shares one parsed document, one layout, one set of routes, one viewBox. Only the styling and metadata differ, so raising or lowering the mode never moves the drawing underneath. The raw SVG in the playground is the exact string Render View displays — not a reconstructed DOM snapshot.

With wire hooks enabled, every signal wire exposes its parser-resolved topology as `data-net-id`: named nets keep their author name and unnamed nets use deterministic `$N` identities. The compilation source map exposes the same value as `SchematicWireSource.netId`; relation-only UML connectors omit it. A [`trunk`](/docs/0.8/grammar#trunks) branch additionally carries `data-wire-trunk="from"` or `"to"` — the end that joins its net — and a junction dot drawn where it leaves the net's copper carries the `schematic-junction` class, so a host can style joins apart from terminals.

```schemd bounds="760x320" title="Mode-parity specimen"
source:SB "cell" at (90, 130) #blue [type=battery]
switch:PB "push" at (300, 130) #amber [type=pushbutton]
load:BZ "buzzer" at (540, 130) #emerald [type=buzzer]

SB.positive -> PB.in #blue [line]
PB.out -> BZ.in #emerald [line]
```

`full` mode keeps diagram-local IDs and provides accessible port targets. It never injects scripts, external fonts, raster assets, data URLs, or `foreignObject`.

<!-- /schemd-section -->

<!-- schemd-section: id=optimization; eyebrow=02 / Bytes; title=Reuse canonical symbols; example-title=Repeated passives -->

Identical components reference a single `<symbol>` definition, and orientation costs only an instance rotation on top of it. A family we never use adds exactly zero bytes to the diagram, which is why a large drawing of few distinct parts stays small.

```schemd bounds="820x300" title="Repeated passives"
capacitor:CA "C" at (130, 120) #cyan
capacitor:CB "C" at (350, 120) #cyan [orientation=down]
capacitor:CC "C" at (580, 120) #cyan [orientation=up]
```

<!-- /schemd-section -->
