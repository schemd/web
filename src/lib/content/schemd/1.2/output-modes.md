<!-- schemd-doc: id=output-modes; label=Output modes; title=Choose the smallest truthful SVG mode; summary=Static output, embedded theme CSS, and full semantic hooks share identical geometry.; category=Ship output; order=60 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate emitted markup, not connectivity. -->

<!-- schemd-section: id=modes; eyebrow=01 / Output; title=Separate geometry from interaction payload; example-title=One drawing, three modes -->

| Mode           | Adds                                                        | Suited to                                          |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| `default`      | accessible static SVG only                                  | articles, exports safe for email, immutable assets |
| `embedded-css` | isolated theme and state classes                            | responsive themed documents                        |
| `full`         | datasets for nodes, ports, wires, source lines and topology | the playground's mapping and simulations           |

Every mode shares one parsed document, one layout, one set of routes and one viewBox. Only the styling and the metadata differ. The drawing never moves. The raw SVG in the playground is the exact string that Render View displays, and no DOM snapshot is rebuilt from it.

With wire hooks enabled, every signal wire is stamped with its resolved topology as `data-net-id`. A named net keeps the author's name, and an unnamed net uses a stable `$N` identity. The compilation's source map exposes the same value as `SchematicWireSource.netId`, which UML connectors that carry only a relation omit. Every junction dot the router draws carries the class `schematic-junction`, so a host can style joins apart from terminals. That covers the dot where a branch leaves its net's copper and the dot where a wire crosses its own net.

A connection written with `trunk` still carries `data-wire-trunk`, and a part declared `fit=wires` carries `data-fit="wires"`, so the decompiler can read both back. A part declared without a label emits no label text, and in `full` mode its `data-node-label` is empty. The root `<svg>` names the measured font stack, `Arial, Helvetica, 'Liberation Sans', Arimo, sans-serif`, as its default.

```schemd bounds="760x320" title="One drawing, three modes"
source:CC "coin cell" at (90, 130) #blue [type=battery]
switch:TG "toggle" at (300, 130) #amber [type=spst]
load:LP "lamp" at (540, 130) #emerald [type=lamp]

CC.positive -> TG.in #blue [line]
TG.out -> LP.in #emerald [line]
```

`full` mode keeps diagram-local IDs and provides accessible port targets. Scripts and external fonts are never injected. Neither are raster images, data URLs or `foreignObject`.

<!-- /schemd-section -->

<!-- schemd-section: id=optimization; eyebrow=02 / Bytes; title=Reuse canonical symbols; example-title=Repeated LEDs -->

A single `<symbol>` definition is shared by identical components. An orientation costs only a rotation of the instance. A [fitted](/docs/1.2/fit) gate or block shares its definition only with parts whose terminals landed in the same places, because its shape depends on its wires. A family that a diagram never uses adds no bytes to it. Hence a large drawing made of few distinct parts stays small.

```schemd bounds="820x300" title="Repeated LEDs"
diode:LA at (130, 120) #emerald [type=led]
diode:LB at (350, 120) #emerald [type=led orientation=down]
diode:LC at (580, 120) #emerald [type=led orientation=up]
```

The three LEDs share one symbol and carry no labels, so each instance costs a reference, a rotation and its designator.

<!-- /schemd-section -->
