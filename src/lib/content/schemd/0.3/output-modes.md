<!-- schemd-doc: id=output-modes; label=Output modes; title=Choose the smallest truthful SVG mode; summary=Static output, embedded theme CSS, and full semantic hooks share identical geometry.; category=Ship output; order=60 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate emitted markup, not connectivity. -->

<!-- schemd-section: id=modes; eyebrow=01 / Output; title=Separate geometry from interaction payload; example-title=Mode-parity specimen -->

| Mode           | Adds                                                 | Use it for                                     |
| -------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `default`      | Accessible static SVG only                           | articles, email-safe exports, immutable assets |
| `embedded-css` | isolated theme and state classes                     | responsive themed documents                    |
| `full`         | node, port, wire, source-line, and topology datasets | playground mapping and simulations             |

All modes use the same parsed document, layout, routes, vectors, and viewBox. Raw SVG in the playground is the exact string used by Render View—not a reconstructed DOM snapshot.

With wire hooks enabled, every signal wire exposes its parser-resolved topology as `data-net-id`: named nets keep their author name and unnamed nets use deterministic `$N` identities. The compilation source map exposes the same value as `SchematicWireSource.netId`; relation-only UML connectors omit it.

```schemd bounds="800x340" title="Mode-parity specimen"
source:S "24 V" at (90, 150) #blue [type=voltage-dc]
protection:CB "breaker" at (320, 150) #amber [type=breaker]
load:FAN "fan" at (600, 150) #emerald [type=motor]

S.positive -> CB.in #blue [line]
CB.out -> FAN.in #emerald [line marker-end=arrow]
```

`full` mode keeps diagram-local IDs and provides accessible port targets. It never injects scripts, external fonts, raster assets, data URLs, or `foreignObject`.

<!-- /schemd-section -->

<!-- schemd-section: id=optimization; eyebrow=02 / Bytes; title=Reuse canonical symbols; example-title=Repeated passives -->

Identical components reference one `<symbol>` definition, and orientation costs only an instance rotation on top of it. A family we never use adds exactly zero bytes to the diagram — the three capacitors below cost one symbol and three transforms.

```schemd bounds="860x320" title="Repeated passives"
capacitor:C1 "C" at (140, 130) #cyan
capacitor:C2 "C" at (380, 130) #cyan [orientation=down]
capacitor:C3 "C" at (620, 130) #cyan [orientation=up]
```

<!-- /schemd-section -->
