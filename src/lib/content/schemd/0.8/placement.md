<!-- schemd-doc: id=placement; label=Placement; title=Place parts by relationship, not by arithmetic; summary=Six relations that resolve to absolute coordinates before anything else runs.; category=Author diagrams; order=25 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->

<!-- schemd-section: id=why; eyebrow=01 / The idea; title=Say where a part sits; example-title=One coordinate, five relations; example-summary=Only VIN states coordinates. -->

Coordinates are fine for four parts. They are tedious for fourteen, and worse when we move one, because every neighbour we positioned against it needs redoing. So a declaration can state a relationship instead:

```text
kind:ID "label" at (x, y) #color [options]
kind:ID "label" right-of VIN by 150 #color [options]
```

Both forms are first-class and can appear in the same document. If we never write a relation, nothing changes — our diagram compiles to exactly the bytes it did before.

```schemd bounds="900x520" title="Relative placement"
// Only VBAT states coordinates.
source:VBAT "V_{bat}" at (90, 150) #blue [type=battery]
resistor:RS1 "10 \Omega" right-of VBAT by 150 #amber
junction:NODE "load node" right-of RS1 by 150 #cyan
capacitor:CB1 "220 \mu F" below NODE by 110 #cyan [type=polarized orientation=down]
port:VLOAD "V_{load}" right-of NODE by 150 #emerald
ground:GS1 "0 V" below RS1 by 190 aligned-x with RS1 #slate

VBAT.positive -> RS1.in #blue [line]
RS1.out -> NODE.node #amber [line]
NODE.node -> CB1.in #cyan [line]
NODE.node -> VLOAD.in #emerald [line marker-end=arrow]
CB1.out -> GS1.in #cyan [ortho]
VBAT.negative -> GS1.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=relations; eyebrow=02 / Vocabulary; title=Four directions, two alignments; example-title=Anchored to a terminal; example-summary=`aligned-y with IN.out` lines the gate up with a pin. -->

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
port:XP "X" at (140, 150) #violet
nor:GN "NOR" right-of XP by 200 aligned-y with XP.out #purple
port:YP "Y" right-of GN by 200 #emerald
clock:RST "RST" below GN by 150 aligned-x with GN #amber

XP.out -> GN.in1 #violet [ortho]
RST.out -> GN.in2 #amber [ortho]
GN.out -> YP.in #purple [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=03 / How it works; title=Relations resolve before anything else sees them; example-title=Mixed forms; example-summary=Absolute and relative declarations, resolved together. -->

This is not a layout engine. It never decides where a part goes — every coordinate follows from a relation we wrote. Relations resolve to one `at (x, y)` _before the AST is finished_, so the netlist, the design rules, the source map, and the renderer never learn relative placement exists. The compiler's test suite pins that: a relative document and the absolute one it resolves to compile to byte-identical SVG.

Resolution is one topological sort and one pass of arithmetic — no solver, no iteration. So:

- **Forward references work.** We can place a part against one declared further down.
- **A cycle is an error**, and the diagnostic names its members: `Placement cycle: A -> C -> B -> A.`
- **Order of evaluation cannot affect the result.** A position depends only on its references' positions.

```schemd bounds="900x560" title="Mixed forms"
source:VDD "V_{dd}" at (110, 260) #purple [type=voltage-dc]
resistor:RG "100 k\Omega" right-of VDD by 130 #cyan
transistor:MN "2N7000" right-of RG by 130 #blue [type=nmos]
resistor:RD "470 \Omega" above MN by 80 aligned-x with MN #cyan
ground:SGND "0 V" at (560, 470) #slate

VDD.positive -> RG.in #purple [line]
RG.out -> MN.gate #cyan [line]
RD.out -> MN.drain #cyan [ortho]
MN.source -> SGND.in #slate [ortho]
VDD.negative -> SGND.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=budget; eyebrow=04 / When it goes wrong; title=Every mistake names its line and its fix; example-title=Reading the resolved coordinates; example-summary=`placements` reports what each relation worked out to. -->

`limits.placementDepth` caps how long a chain may be, and defaults to 64. Every diagnostic carries its line:

| We wrote                            | It says                                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A reference to something undeclared | `B is placed relative to R9, which the document never declares. Declare R9 anywhere in the document, or place B with at (x, y).` |
| A part placed against itself        | `B is placed relative to itself.`                                                                                                |
| A cycle                             | `Placement cycle: A -> C -> B -> A. One component in a cycle must be placed with at (x, y).`                                     |
| `by -80`                            | `B states a negative by distance of -80. Distances are unsigned; use the opposite direction instead.`                            |
| A terminal that does not exist      | `A has no terminal named clock, so B cannot be placed against it.`                                                               |
| Too long a chain                    | `P5 sits 5 placements deep, past the 4 chain budget. Anchor one component in the chain with at (x, y).`                          |

A relation that pushes a part off the canvas is not a new kind of error — it reaches the same out-of-bounds diagnostic a bad `at (x, y)` would, naming a coordinate that fits.

The compilation carries the resolved numbers:

```ts
const { placements } = compileSchematic(source, fence);
// [{ id: 'R1', line: 3, resolved: { x: 332, y: 150 },
//    relations: [{ kind: 'right-of', ref: 'VIN', gap: 150 }] }, …]
```

It is empty when we used only coordinates, sorted by source line, and its relations carry canonical terminal names, so a reported relation always agrees with the netlist. The [inspector](/inspector/0.8.0) shows it in its Place stage.

```schemd bounds="960x400" title="Reading the resolved coordinates"
port:SRC "S" at (120, 200) #violet
inductor:LA "L" right-of SRC by 160 #purple
inductor:LB "L" right-of LA by 160 #amber
port:DST "D" right-of LB by 160 #emerald

SRC.out -> LA.in #violet [line]
LA.out -> LB.in #purple [line]
LB.out -> DST.in #emerald [line]
```

<!-- /schemd-section -->
