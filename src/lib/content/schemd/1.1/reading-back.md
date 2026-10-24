<!-- schemd-doc: id=reading-back; label=Reading it back; title=Read a compiled diagram back out; summary=A text digest of the geometry, and recovering declarations from the SVG itself.; category=Ship output; order=75 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->

<!-- schemd-section: id=snapshot; eyebrow=01 / Digest; title=Review geometry as text, not as an image; example-title=The digested diagram; example-summary=Five components and four traces, in source order. -->

Pixel goldens answer "does this render correctly?" — a question only a browser can settle. They answer "did anything move?" badly: a shifted vertex arrives as a red blob, and we cannot see _what_ moved without opening two images side by side.

`snapshotSchematic` answers the second question in text:

```ts
import { snapshotSchematic } from '@schemd/core/snapshot';

const digest = snapshotSchematic(document, fence);
```

```text
schemd-snapshot 1
bounds 900x520
component R1 resistor rect=(280.000,124.000,100.000,52.000) at=(330.000,150.000) color=token:amber
component C1 capacitor rect=(536.000,296.000,48.000,48.000) at=(560.000,320.000) orient=down color=token:cyan
trace VIN.positive->R1.in curve=line markers=none/none color=token:blue net=$1 vertices=[(152.000,150.000),(280.000,150.000)]
```

Every rectangle and every vertex, at the three decimals the SVG writer uses, in source order. Commit it as a fixture and a routing change reviews as the handful of coordinates that actually moved.

Two things worth knowing. The leading `schemd-snapshot 1` is a format version — a committed fixture outlives the code that wrote it, and without that line a future format change would read as a diff in every snapshot at once. And an orientation appears only when the declaration stated one, because a part with no orientation is a different declaration from one that names its canonical direction.

This does **not** replace a renderer. Nothing in a digest can tell us an arrowhead went missing or a label collided, which is why the compiler keeps its Chromium goldens for exactly those cases.

```schemd bounds="900x560" title="The digested diagram"
source:VPS "DC" at (110, 150) #blue [type=voltage-dc]
resistor:RPS "68 \Omega" at (330, 150) #amber
junction:NPS "V_{z}" at (560, 150) #cyan
diode:ZPS "5.1 V" at (560, 320) #purple [type=zener orientation=up]
ground:GPS "0 V" at (560, 460) #slate

VPS.positive -> RPS.in #blue [ortho]
RPS.out -> NPS.node #amber [ortho]
NPS.node -> ZPS.cathode #purple [ortho]
ZPS.anode -> GPS.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=recover; eyebrow=02 / Recovery; title=The output is readable back; example-title=What comes back; example-summary=Placement, paint, curve, topology — and a fitted CNOT's fit=wires — all survive. -->

`full` mode already stamps a great deal on the markup: each node group carries its id, kind, label, source line and orientation, sits at a `translate`, and is painted with a colour token; each wire group carries its endpoints, net, signal domain and bus width. That is most of a declaration, sitting unread.

```ts
import { parseSchematicSvg } from '@schemd/core/decompile';

const { components, connections, source, lost } = parseSchematicSvg(svg);
```

It is a bounded scanner over the attribute set the renderer writes, not an XML parser — the only inputs that need to work are diagrams this compiler produced. Give it `default` or `embedded-css` output and it refuses, because that markup carries no hooks at all.

What survives: every component's id, kind, label, coordinates, orientation and colour, and since 1.1 a part's `fit=wires`, read from `data-fit` — its recovered position is the fitted one, so recompiling fits it to the same place; every connection's endpoints, curve, colour, markers, bus width and signal domain. A connection written with `trunk` carries `data-wire-trunk` and reads back as `trunk: true`; every net is drawn as a tree either way, so recovered source recompiles to the same drawing. A [sub-circuit](/docs/1.1/subcircuits) does not survive as a block — the SVG holds only the flattened parts, so we get `U1_RT` and `U1_RB` back rather than `divider:U1`, and nothing pretends otherwise. The curve comes from the path that was drawn — `bezier` is the only one that emits `C`, `ortho` walks in `H`/`V` steps — so it is read rather than assumed.

```schemd bounds="880x440" title="What comes back"
prepare:RA0 "|0\rangle" at (120, 140) #blue
prepare:RA1 "|1\rangle" at (120, 300) #blue
cnot:RX "CNOT" at (420, 220) #purple [fit=wires]
port:RO0 "q_0" at (740, 140) #emerald
port:RO1 "q_1" at (740, 300) #emerald

RA0.out -> RX.in1 #blue [ortho]
RA1.out -> RX.in2 #blue [ortho]
RX.out1 -> RO0.in #purple [ortho]
RX.out2 -> RO1.in #purple [ortho marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=lost; eyebrow=03 / Honesty; title=What does not come back, named; example-title=A variant that cannot survive; example-summary=Both are `data-node-kind="capacitor"` in the markup. -->

Recovery is partial, and it says which parts. Family options — `type=`, `variant=` — are not stamped anywhere a scanner can read; they survive only as prose inside each group's `aria-label`. A recovered capacitor is a fixed capacitor even if it was declared polarized.

```ts
recovery.lost;
// [{ code: 'component-variant', detail: 'Family options such as type= …' }]
```

There is deliberately no `fidelity: 'exact'` alongside that list. Any document with a component loses something, so a flag that can only ever hold one value would tell us nothing; the list tells us what.

The same principle governs malformed input. A group missing anything `full` mode always writes is skipped rather than guessed at — inventing a label, a source line, or a straight-line curve for markup that was edited after the fact would put a fabricated declaration into recovered source, which is worse than admitting the group could not be read.

What we get back is therefore a faithful account of topology, placement and paint. It is not a promise that recompiling reproduces the original bytes, and the compiler's own suite pins the honest version of that claim: recovered source recompiles to the same topology, the same placement, and is itself a fixed point.

```schemd bounds="820x360" title="A variant that cannot survive"
capacitor:CF1 "fixed" at (250, 180) #cyan
capacitor:CF2 "polarized" right-of CF1 by 200 #cyan [type=polarized]

CF1.out -> CF2.in #cyan [line]
```

<!-- /schemd-section -->
