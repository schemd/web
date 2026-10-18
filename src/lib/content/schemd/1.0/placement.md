<!-- schemd-doc: id=placement; label=Placement; title=Place parts by relationship, not by arithmetic; summary=Six relations that resolve to absolute coordinates before anything else runs.; category=Author diagrams; order=25 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->

<!-- schemd-section: id=why; eyebrow=01 / The idea; title=Say where a part sits; example-title=One coordinate, five relations; example-summary=Only VSUP states coordinates. -->

Coordinates are fine for four parts. They are tedious for fourteen, and worse when we move one, because every neighbour we positioned against it needs redoing. So a declaration can state a relationship instead:

```text
kind:ID "label" at (x, y) #color [options]
kind:ID "label" right-of VIN by 150 #color [options]
```

Both forms are first-class and can appear in the same document. If we never write a relation, nothing changes — our diagram compiles to exactly the bytes it did before.

```schemd bounds="900x560" title="Relative placement"
// Only VSUP states coordinates.
source:VSUP "V_{sup}" at (90, 150) #blue [type=voltage-dc]
protection:FU "500 mA" right-of VSUP by 150 #amber [type=fuse]
junction:RAIL "rail" right-of FU by 150 #cyan
capacitor:CR "47 \mu F" below RAIL by 110 #cyan [type=polarized orientation=down]
port:VOUT "V_{out}" right-of RAIL by 150 #emerald
ground:GR "0 V" below FU by 190 aligned-x with FU #slate

VSUP.positive -> FU.in #blue [ortho]
FU.out -> RAIL.node #amber [ortho]
RAIL.node -> CR.in #cyan [ortho]
RAIL.node -> VOUT.in #emerald [ortho marker-end=arrow]
CR.out -> GR.in #cyan [ortho]
VSUP.negative -> GR.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=relations; eyebrow=02 / Vocabulary; title=Four directions, two alignments; example-title=Anchored to a terminal; example-summary=`aligned-y with AP.out` lines the gate up with a pin. -->

There are six relations. Each takes a component or one of its terminals, and the four directions take an optional `by` distance:

| Relation             | Sets                                                 | `by` |
| -------------------- | ---------------------------------------------------- | ---- |
| `right-of REF`       | x, our left edge clear of the reference's right edge | yes  |
| `left-of REF`        | x, our right edge clear of the reference's left edge | yes  |
| `below REF`          | y, our top edge clear of the reference's bottom edge | yes  |
| `above REF`          | y, our bottom edge clear of the reference's top edge | yes  |
| `aligned-x with REF` | x, copied from the reference                         | no   |
| `aligned-y with REF` | y, copied from the reference                         | no   |

Two details matter. A direction measures from the **body**, not the origin, so `by 150` is 150 units of clear space between facing edges — the room we actually asked for, and still correct when the reference is rotated. Omit `by` and we get the axis default: 160 horizontally, 140 vertically.

And an axis that no relation sets is **inherited from the first reference**, so `right-of A` puts us beside A and level with it. An alignment overrides that, which is how a part takes its column from one component and its row from another:

```schemd bounds="880x520" title="Anchored to a terminal"
port:AP "A" at (140, 150) #blue
xor:GX "XOR" right-of AP by 200 aligned-y with AP.out #purple
port:ZP "Z" right-of GX by 200 #emerald
clock:EN "EN" below GX by 150 aligned-x with GX #amber

AP.out -> GX.in1 #blue [ortho]
EN.out -> GX.in2 #amber [ortho]
GX.out -> ZP.in #purple [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=03 / How it works; title=Relations resolve before anything else sees them; example-title=Mixed forms; example-summary=Absolute and relative declarations, resolved together. -->

This is not a layout engine. It never decides where a part goes — every coordinate follows from a relation we wrote. Relations resolve to one `at (x, y)` _before the AST is finished_, so the netlist, the design rules, the source map, and the renderer never learn relative placement exists. The compiler's test suite pins that: a relative document and the absolute one it resolves to compile to byte-identical SVG.

Resolution is one topological sort and one pass of arithmetic — no solver, no iteration. So:

- **Forward references work.** We can place a part against one declared further down.
- **A cycle is an error**, and the diagnostic names its members: `Placement cycle: A -> C -> B -> A.`
- **Order of evaluation cannot affect the result.** A position depends only on its references' positions.

```schemd bounds="900x600" title="Mixed forms"
source:VBB "V_{bb}" at (110, 300) #purple [type=voltage-dc]
resistor:RB "47 k\Omega" right-of VBB by 130 #cyan
transistor:QN "BC547" right-of RB by 130 #blue [type=npn]
resistor:RC "1 k\Omega" above QN by 80 aligned-x with QN #cyan [orientation=down]
ground:EGND "0 V" at (560, 510) #slate

VBB.positive -> RB.in #purple [ortho]
RB.out -> QN.base #cyan [ortho]
RC.out -> QN.collector #cyan [ortho]
QN.emitter -> EGND.in #slate [ortho]
VBB.negative -> EGND.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=budget; eyebrow=04 / When it goes wrong; title=Every mistake names its line and its fix; example-title=Reading the resolved coordinates; example-summary=`placements` reports what each relation worked out to. -->

`limits.placementDepth` caps how long a chain may be, and defaults to 64. Every diagnostic carries its line:

| We wrote                            | It says                                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A reference to something undeclared | `B is placed relative to R9, which the document never declares. Declare R9 anywhere in the document, or place B with at (x, y).` |
| A part placed against itself        | `B is placed relative to itself. Reference another declaration, or place it with at (x, y).`                                     |
| A cycle                             | `Placement cycle: A -> B -> C -> A. One component in a cycle must be placed with at (x, y).`                                     |
| `by -80`                            | `B states a negative by distance of -80. Distances are unsigned; use the opposite direction instead.`                            |
| A terminal that does not exist      | `A has no terminal named clock, so B cannot be placed against it. Reference A itself, or name a terminal it declares.`           |
| Too long a chain                    | `P5 sits 5 placements deep, past the 4 chain budget. Anchor one component in the chain with at (x, y).`                          |

[`diagnoseSchematic`](/docs/1.0/diagnostics) reports every broken relation at once, each at the columns of the reference at fault, and a cycle once, at its first stuck line; nothing placed against a broken declaration is blamed again. Placement arithmetic is in integer milli-units, so a relation and its mirror image land exactly opposite each other.

A relation that pushes a part off the canvas is not a new kind of error — it reaches the same out-of-bounds diagnostic a bad `at (x, y)` would, naming a coordinate that fits.

The compilation carries the resolved numbers:

```ts
const { placements } = compileSchematic(source, fence);
// [{ id: 'R1', line: 3, resolved: { x: 332, y: 150 },
//    relations: [{ kind: 'right-of', ref: 'VIN', gap: 150 }] }, …]
```

It is empty when we used only coordinates, sorted by source line, and its relations carry canonical terminal names, so a reported relation always agrees with the netlist. The [inspector](/inspector/1.0.0) shows it in its Place stage.

```schemd bounds="960x400" title="Reading the resolved coordinates"
port:SRC "S" at (120, 200) #violet
capacitor:CA "C" right-of SRC by 160 #cyan
capacitor:CB "C" right-of CA by 160 #purple
port:DST "D" right-of CB by 160 #emerald

SRC.out -> CA.in #violet [line]
CA.out -> CB.in #cyan [line]
CB.out -> DST.in #emerald [line]
```

<!-- /schemd-section -->
