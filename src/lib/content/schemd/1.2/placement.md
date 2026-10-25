<!-- schemd-doc: id=placement; label=Placement; title=Place parts by relationship, not by arithmetic; summary=Six relations that resolve to absolute coordinates before anything else runs.; category=Author diagrams; order=25 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->

<!-- schemd-section: id=why; eyebrow=01 / The idea; title=Say where a part sits; example-title=Relative placement; example-summary=Only VIN states coordinates. -->

Coordinates serve well for four parts. For fourteen they become tedious, and moving one part means repositioning every neighbour placed against it. A declaration may therefore state a relationship in place of a coordinate:

```text
kind:ID "label" at (x, y) #color [options]
kind:ID "label" right-of VIN by 150 #color [options]
```

Both forms are first-class, and one document may mix them. The label is optional in either form. A document that never writes a relation compiles to exactly the bytes it did before.

```schemd bounds="900x560" title="Relative placement"
// Only VIN states coordinates.
source:VIN "5 V" at (90, 170) #blue [type=voltage-dc]
diode:DS "schottky" right-of VIN by 150 #rose [type=schottky]
junction:VSYS right-of DS by 150 #cyan
capacitor:CB "22 \mu F" below VSYS by 110 #cyan [type=polarized orientation=down]
port:SYS "system" right-of VSYS by 150 #emerald
ground:G0 "0 V" below DS by 190 aligned-x with DS #slate

VIN.positive -> DS.anode #blue [ortho]
DS.cathode -> VSYS.node #rose [ortho]
VSYS.node -> CB.in #cyan [ortho]
VSYS.node -> SYS.in #emerald [ortho marker-end=arrow]
CB.out -> G0.in #cyan [ortho]
VIN.negative -> G0.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=relations; eyebrow=02 / Vocabulary; title=Four directions, two alignments; example-title=Anchored to a part; example-summary=`aligned-y with AP` lines the gate's centre up with the port. -->

There are six relations. Each one takes a component or one of its terminals. The four directions accept an optional `by` distance, and the two alignments accept an optional `at` terminal of the part being placed:

| Relation             | Sets                                                      | `by` |
| -------------------- | --------------------------------------------------------- | ---- |
| `right-of REF`       | x: the part's left edge clears the reference's right edge | yes  |
| `left-of REF`        | x: the part's right edge clears the reference's left edge | yes  |
| `below REF`          | y: the part's top edge clears the reference's bottom edge | yes  |
| `above REF`          | y: the part's bottom edge clears the reference's top edge | yes  |
| `aligned-x with REF` | x, copied from the reference                              | no   |
| `aligned-y with REF` | y, copied from the reference                              | no   |

Either alignment can end with `at PORT` to line up one of the part's own terminals in place of its origin. The [next section](#terminals) covers that.

Two details matter here. A direction measures from the body of the reference and never from its origin. Hence `by 150` means 150 units of clear space between the facing edges, which is the room that was asked for, and it stays correct when the reference is rotated. Without `by`, the default is 160 units across and 140 units down.

An axis that no relation sets is inherited from the first reference. `right-of A` therefore puts a part beside A and level with it. An alignment overrides that inheritance, and this is how a part takes its column from one component and its row from another:

```schemd bounds="880x520" title="Anchored to a part"
port:AP "A" at (140, 160) #blue
xor:GX "XOR" right-of AP by 200 aligned-y with AP #purple
port:YP "Y" right-of GX by 200 #emerald
port:SEL "sel" below GX by 150 aligned-x with GX #amber [orientation=up]

AP.out -> GX.in1 #blue [ortho]
SEL.out -> GX.in2 #amber [ortho]
GX.out -> YP.in #purple [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=terminals; eyebrow=03 / Terminals; title=Line up a terminal, not a centre; example-title=Terminal to terminal; example-summary=Each gate is placed so that one of its inputs sits level with the wire that feeds it. -->

An alignment copies a coordinate onto the part's origin. That suits a resistor, whose pins sit on its centre line. It does not suit a gate, whose inputs sit above and below its centre: `aligned-y with R.out` leaves the input off the wire, and the wire jogs to reach it.

Since 1.1 the alignment can therefore name one of the part's own terminals with `at`:

```text
and:G2 "G" right-of R2 by 80 aligned-y with R2.out at in2 #blue [inputs=2]
```

The part lands wherever its `in2` sits level with `R2.out`. Either side may be a terminal. `REF.port` measures from a terminal of the reference, and `at PORT` from a terminal of the part. The terminal is folded to its canonical name, so `at out` on a gate is reported as `out1`. A terminal the part does not have is reported with its line: `R1 has no terminal named nowhere to line up with G1. Name one of R1's terminals, or remove at nowhere to align its centre.`

Lining up one terminal is not enough for a part that spans several wires, such as a CNOT or an IC. [`fit=wires`](/docs/1.2/fit) exists for that case.

```schemd bounds="900x420" title="Terminal to terminal"
port:IA "a" at (100, 130) #blue
capacitor:CA "1 nF" right-of IA by 100 #cyan
nand:GA "NAND" right-of CA by 100 aligned-y with CA.out at in1 #purple [inputs=2]
port:IB "b" at (100, 300) #blue
resistor:RB "4.7 k\Omega" right-of IB by 100 #amber
nor:GB "NOR" right-of RB by 100 aligned-y with RB.out at in2 #purple [inputs=2]

IA.out -> CA.in #blue [ortho]
CA.out -> GA.in1 #cyan [ortho]
IB.out -> RB.in #blue [ortho]
RB.out -> GB.in2 #amber [ortho]
```

The NAND is lined up by its first input and the NOR by its second, so both wires arrive straight.

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=04 / How it works; title=Relations resolve before anything else sees them; example-title=Mixed forms; example-summary=Absolute and relative declarations, resolved together. -->

Placement is no layout engine. It never decides where a part goes, because every coordinate follows from a relation the author wrote. Relations resolve to one `at (x, y)` before the AST is finished. The netlist, the design rules, the source map and the renderer never learn that relative placement exists. The compiler's tests pin this: a relative document and the absolute document it resolves to compile to byte-identical SVG.

Resolution is one topological sort and one pass of arithmetic, with no solver and no iteration. As a result:

- A forward reference works. A part can be placed against one declared further down.
- A cycle is an error, and the diagnostic names its members: `Placement cycle: A -> C -> B -> A.`
- The order of evaluation cannot affect the result, since a position depends only on the positions of its references.

```schemd bounds="900x600" title="Mixed forms"
source:VBB "V_{bb}" at (110, 300) #purple [type=voltage-dc]
resistor:RB1 "47 k\Omega" right-of VBB by 130 #cyan
transistor:Q1 "2N3904" right-of RB1 by 130 #blue [type=npn]
resistor:RC1 "1 k\Omega" above Q1 by 80 aligned-x with Q1 #cyan [orientation=down]
ground:EG "0 V" at (560, 510) #slate

VBB.positive -> RB1.in #purple [ortho]
RB1.out -> Q1.base #cyan [ortho]
RC1.out -> Q1.collector #cyan [ortho]
Q1.emitter -> EG.in #slate [ortho]
VBB.negative -> EG.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=budget; eyebrow=05 / When it goes wrong; title=Every mistake names its line and its fix; example-title=Reading the resolved coordinates; example-summary=`placements` reports what each relation worked out to. -->

`limits.placementDepth` caps the length of a chain and defaults to 64. Every diagnostic carries its line:

| Written                                 | Reported                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A reference to something undeclared     | `B is placed relative to R9, which the document never declares. Declare R9 anywhere in the document, or place B with at (x, y).` |
| A part placed against itself            | `B is placed relative to itself. Reference another declaration, or place it with at (x, y).`                                     |
| A cycle                                 | `Placement cycle: A -> B -> C -> A. One component in a cycle must be placed with at (x, y).`                                     |
| `by -80`                                | `B states a negative by distance of -80. Distances are unsigned; use the opposite direction instead.`                            |
| A terminal that does not exist          | `A has no terminal named clock, so B cannot be placed against it. Reference A itself, or name a terminal it declares.`           |
| An `at` terminal the part does not have | `B has no terminal named clock to line up with A. Name one of B's terminals, or remove at clock to align its centre.`            |
| Too long a chain                        | `P5 sits 5 placements deep, past the 4 chain budget. Anchor one component in the chain with at (x, y).`                          |

[`diagnoseSchematic`](/docs/1.2/diagnostics) reports every broken relation at once, each at the columns of the reference at fault. A cycle is reported once, at its first stuck line, and nothing placed against a broken declaration is blamed again. That includes a declaration whose own line failed, for instance through an unknown option: the parts placed against it are left unplaced, and they are not reported as referencing something undeclared. Placement arithmetic works in integer milli-units, so a relation and its mirror image land exactly opposite each other.

A relation that pushes a part off the canvas raises the same out-of-bounds diagnostic as a bad `at (x, y)`, and it names a coordinate that fits.

The compilation carries the resolved numbers:

```ts
const { placements } = compileSchematic(source, fence);
// [{ id: 'R1', line: 2, resolved: { x: 372, y: 200 },
//    relations: [{ kind: 'right-of', ref: 'SRC', gap: 160 }] }, …]
```

The list is empty for a document that uses only coordinates, and it is sorted by source line. Its relations carry canonical terminal names, so a reported relation always agrees with the netlist. The [inspector](/inspector/1.2.0) shows the list in its Place stage.

```schemd bounds="960x400" title="Reading the resolved coordinates"
port:SRC "in" at (120, 200) #violet
resistor:R1 "R" right-of SRC by 160 #amber
capacitor:C1 "C" right-of R1 by 160 #cyan
port:DST "out" right-of C1 by 160 #emerald

SRC.out -> R1.in #violet [line]
R1.out -> C1.in #amber [line]
C1.out -> DST.in #cyan [line]
```

<!-- /schemd-section -->
