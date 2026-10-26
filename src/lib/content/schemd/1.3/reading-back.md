<!-- schemd-doc: id=reading-back; label=Reading it back; title=Read a compiled diagram back out; summary=A text digest of the geometry, and recovering declarations from the SVG itself.; category=Ship output; order=75 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->

<!-- schemd-section: id=snapshot; eyebrow=01 / Digest; title=Review geometry as text, not as an image; example-title=The digested diagram; example-summary=Five components and four traces, in source order. -->

Pixel goldens show whether a drawing renders correctly, and only a browser can settle that. They show poorly whether anything moved. A shifted vertex arrives as a red blob, and two images must be opened side by side to see what changed.

`snapshotSchematic` answers the second question in text:

```ts
import { snapshotSchematic } from '@schemd/core/snapshot';

const digest = snapshotSchematic(document, fence);
```

For the figure beside this, the digest begins:

```text
schemd-snapshot 1
bounds 900x560
component RB resistor rect=(284.000,110.000,92.000,82.000) at=(330.000,150.000) color=token:amber
component CB capacitor rect=(535.540,256.000,48.920,130.000) at=(560.000,320.000) orient=down color=token:purple
trace VB.positive->RB.in curve=ortho markers=none/none color=token:blue net=$1 vertices=[(152.000,150.000),(288.000,150.000)]
```

It lists every rectangle and every vertex in source order, at the three decimals the SVG writer uses. Committed as a fixture, it turns a routing change into a review of the few coordinates that actually moved.

Two details are worth knowing. The leading `schemd-snapshot 1` is a format version. A committed fixture outlives the code that wrote it, and without that line a later format change would appear as a diff in every snapshot at once. An orientation also appears only when the declaration stated one, since a part with no orientation is a different declaration from one that names its canonical direction.

A digest does not replace a renderer. It cannot show that an arrowhead went missing or that a label collided, so the compiler keeps its Chromium goldens for exactly those cases.

```schemd bounds="900x560" title="The digested diagram"
source:VB "5 V" at (110, 150) #blue [type=voltage-dc]
resistor:RB "4.7 k\Omega" at (330, 150) #amber
junction:NB at (560, 150) #cyan
capacitor:CB "100 \mu F" at (560, 320) #purple [type=polarized orientation=down]
ground:GB "0 V" at (560, 470) #slate

VB.positive -> RB.in #blue [ortho]
RB.out -> NB.node #amber [ortho]
NB.node -> CB.in #purple [ortho]
CB.out -> GB.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=recover; eyebrow=02 / Recovery; title=The output is readable back; example-title=What comes back; example-summary=Placement, paint, curve and topology all survive, along with a fitted CNOT's fit=wires and its missing label. -->

`full` mode already stamps a great deal on the markup. Each node group carries its ID, kind, label, source line and orientation, sits at a `translate` and is painted with a colour token. A wire group carries its endpoints and net, together with its signal domain and bus width. Most of a declaration is therefore already in the markup, unread.

```ts
import { parseSchematicSvg } from '@schemd/core/decompile';

const { components, connections, source, lost } = parseSchematicSvg(svg);
```

It is a bounded scanner over the attributes the renderer writes, and no XML parser, because the only inputs that need to work are diagrams this compiler produced. It refuses `default` or `embedded-css` output, since that markup carries no hooks at all.

Every component's ID, kind, label, coordinates, orientation and colour survive. A part's `fit=wires` is read from `data-fit`, and its recovered position is the fitted one, so recompiling fits it to the same place. A part declared without a label comes back without one: the figure's CNOT is recovered as `cnot:RQ at (440, 220) #purple [fit=wires]`. Every connection keeps its endpoints, curve, colour and markers, as well as its bus width and signal domain. A connection written with `trunk` carries `data-wire-trunk` and reads back as `trunk: true`. Every net is drawn as a tree either way, so the recovered source recompiles to the same drawing.

A [sub-circuit](/docs/1.3/subcircuits) does not survive as a block. The SVG holds only the flattened parts, so the result contains `U1_RT` and `U1_RB` and no `divider:U1`, and nothing pretends otherwise. The curve is read from the path that was drawn. Only `bezier` emits `C`, and `ortho` walks in `H` and `V` steps.

```schemd bounds="880x440" title="What comes back"
prepare:RB0 "|0\rangle" at (120, 140) #blue
prepare:RB1 "|1\rangle" at (120, 300) #blue
cnot:RQ at (440, 220) #purple [fit=wires]
port:RO0 "x" at (760, 140) #emerald
port:RO1 "y" at (760, 300) #emerald

RB0.out -> RQ.in1 #blue [ortho]
RB1.out -> RQ.in2 #blue [ortho]
RQ.out1 -> RO0.in #purple [ortho]
RQ.out2 -> RO1.in #purple [ortho marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=lost; eyebrow=03 / Honesty; title=What does not come back, named; example-title=A variant that does not come back; example-summary=Both are `data-node-kind="diode"` in the markup. -->

Recovery is partial, and it says which parts are missing. Family options such as `type=` and `variant=` are stamped nowhere a scanner can read, and they survive only as prose inside each group's `aria-label`. A recovered diode is a standard diode even when it was declared as a Schottky.

```ts
recovery.lost;
// [{ code: 'component-variant', detail: 'Family options such as type= …' }, …]
```

There is deliberately no `fidelity: 'exact'` beside that list. Any document with a component loses something, so a flag that could only ever hold one value would say nothing. The list says what was lost.

Malformed input follows the same principle. A group that lacks anything `full` mode always writes is skipped. Inventing a label, a source line or a curve for markup edited after compilation would put a fabricated declaration into the recovered source, which is worse than admitting that the group could not be read.

The result is a faithful account of topology, placement and paint. It is no promise that recompiling reproduces the original bytes. The compiler's own tests pin the honest form of the claim: recovered source recompiles to the same topology and the same placement, and it is a fixed point of recovery.

```schemd bounds="820x360" title="A variant that does not come back"
diode:DS1 "standard" at (250, 180) #rose
diode:DS2 "schottky" right-of DS1 by 200 #rose [type=schottky]

DS1.cathode -> DS2.anode #rose [line]
```

<!-- /schemd-section -->
