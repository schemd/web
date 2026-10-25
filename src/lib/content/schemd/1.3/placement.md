<!-- schemd-doc: id=placement; label=Placement; title=Place parts by relationship, not by arithmetic; summary=Six relations that resolve to absolute coordinates before anything else runs.; category=Author diagrams; order=25 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->

<!-- schemd-section: id=why; eyebrow=01 / The idea; title=Say where a part sits; example-title=Relative placement; example-summary=Only BAT states coordinates. -->

Coordinates serve well for four parts. For fourteen they become tedious, and moving one part means repositioning every neighbour placed against it. A declaration may therefore state a relationship in place of a coordinate:

```text
kind:ID "label" at (x, y) #color [options]
kind:ID "label" right-of VIN by 150 #color [options]
```

Both forms are first-class, and one document may mix them. The label is optional in either form. A document that never writes a relation compiles to exactly the bytes it did before.

```schemd bounds="900x560" title="Relative placement"
// Only BAT states coordinates.
source:BAT "9 V" at (90, 170) #blue [type=battery]
protection:FU "500 mA" right-of BAT by 150 #amber [type=fuse]
junction:VBUS right-of FU by 150 #cyan
capacitor:CBK "47 \mu F" below VBUS by 110 #cyan [type=polarized orientation=down]
port:LOAD "load" right-of VBUS by 150 #emerald
ground:GR "0 V" below FU by 190 aligned-x with FU #slate

BAT.positive -> FU.in #blue [ortho]
FU.out -> VBUS.node #amber [ortho]
VBUS.node -> CBK.in #cyan [ortho]
VBUS.node -> LOAD.in #emerald [ortho marker-end=arrow]
CBK.out -> GR.in #cyan [ortho]
BAT.negative -> GR.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=relations; eyebrow=02 / Vocabulary; title=Four directions, two alignments; example-title=Anchored to a part; example-summary=`aligned-y with EN` lines the gate's centre up with the port. -->

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
port:EN "EN" at (140, 160) #blue
or:GO "OR" right-of EN by 200 aligned-y with EN #purple
port:OUTO "Q" right-of GO by 200 #emerald
port:RST "reset" below GO by 150 aligned-x with GO #amber [orientation=up]

EN.out -> GO.in1 #blue [ortho]
RST.out -> GO.in2 #amber [ortho]
GO.out -> OUTO.in #purple [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=terminals; eyebrow=03 / Terminals; title=Line up a terminal, not a centre; example-title=Terminal to terminal; example-summary=Each gate is placed so that one of its inputs sits level with the wire that feeds it. -->

An alignment copies a coordinate onto the part's origin. That suits a resistor, whose pins sit on its centre line. It does not suit a gate, whose inputs sit above and below its centre: `aligned-y with R.out` leaves the input off the wire, and the wire jogs to reach it.

Since 1.1 the alignment can therefore name one of the part's own terminals with `at`:

```text
and:G2 "G" right-of R2 by 80 aligned-y with R2.out at in2 #blue [inputs=2]
```

The part lands wherever its `in2` sits level with `R2.out`. Either side may be a terminal. `REF.port` measures from a terminal of the reference, and `at PORT` from a terminal of the part. The terminal is folded to its canonical name, so `at out` on a gate is reported as `out1`. A terminal the part does not have is reported with its line: `R1 has no terminal named nowhere to line up with G1. Name one of R1's terminals, or remove at nowhere to align its centre.`

Lining up one terminal is not enough for a part that spans several wires, such as a CNOT or an IC. [`fit=wires`](/docs/1.3/fit) exists for that case.

```schemd bounds="900x420" title="Terminal to terminal"
port:IC "c" at (100, 130) #blue
inductor:LC "10 \mu H" right-of IC by 100 #purple
and:GAN "AND" right-of LC by 100 aligned-y with LC.out at in2 #purple [inputs=2]
port:ID "d" at (100, 300) #blue
diode:DD "D" right-of ID by 100 #rose
or:GOR "OR" right-of DD by 100 aligned-y with DD.cathode at in1 #purple [inputs=2]

IC.out -> LC.in #blue [ortho]
LC.out -> GAN.in2 #purple [ortho]
ID.out -> DD.anode #blue [ortho]
DD.cathode -> GOR.in1 #rose [ortho]
```

The AND is lined up by its second input and the OR by its first, so both wires arrive straight.

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=04 / How it works; title=Relations resolve before anything else sees them; example-title=Mixed forms; example-summary=Absolute and relative declarations, resolved together. -->

Placement is no layout engine. It never decides where a part goes, because every coordinate follows from a relation the author wrote. Relations resolve to one `at (x, y)` before the AST is finished. The netlist, the design rules, the source map and the renderer never learn that relative placement exists. The compiler's tests pin this: a relative document and the absolute document it resolves to compile to byte-identical SVG.

Resolution is one topological sort and one pass of arithmetic, with no solver and no iteration. As a result:

- A forward reference works. A part can be placed against one declared further down.
- A cycle is an error, and the diagnostic names its members: `Placement cycle: A -> C -> B -> A.`
- The order of evaluation cannot affect the result, since a position depends only on the positions of its references.

```schemd bounds="900x600" title="Mixed forms"
source:VGS "V_{gs}" at (110, 300) #purple [type=voltage-dc]
resistor:RGJ "1 M\Omega" right-of VGS by 130 #cyan
transistor:JF "J201" right-of RGJ by 130 #blue [type=njfet]
resistor:RDJ "2.2 k\Omega" above JF by 80 aligned-x with JF #cyan [orientation=down]
ground:JG "0 V" at (560, 510) #slate

VGS.positive -> RGJ.in #purple [ortho]
RGJ.out -> JF.gate #cyan [ortho]
RDJ.out -> JF.drain #cyan [ortho]
JF.source -> JG.in #slate [ortho]
VGS.negative -> JG.in #slate [ortho]
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

[`diagnoseSchematic`](/docs/1.3/diagnostics) reports every broken relation at once, each at the columns of the reference at fault. A cycle is reported once, at its first stuck line, and nothing placed against a broken declaration is blamed again. That includes a declaration whose own line failed, for instance through an unknown option: the parts placed against it are left unplaced, and they are not reported as referencing something undeclared. Placement arithmetic works in integer milli-units, so a relation and its mirror image land exactly opposite each other.

A relation that pushes a part off the canvas raises the same out-of-bounds diagnostic as a bad `at (x, y)`, and it names a coordinate that fits.

The compilation carries the resolved numbers:

```ts
const { placements } = compileSchematic(source, fence);
// [{ id: 'L1', line: 2, resolved: { x: 372, y: 200 },
//    relations: [{ kind: 'right-of', ref: 'FROM', gap: 160 }] }, …]
```

The list is empty for a document that uses only coordinates, and it is sorted by source line. Its relations carry canonical terminal names, so a reported relation always agrees with the netlist. The [inspector](/inspector/1.3.0) shows the list in its Place stage.

```schemd bounds="960x400" title="Reading the resolved coordinates"
port:FROM "in" at (120, 200) #violet
inductor:L1 "L" right-of FROM by 160 #purple
resistor:R1 "R" right-of L1 by 160 #amber
port:TO "out" right-of R1 by 160 #emerald

FROM.out -> L1.in #violet [line]
L1.out -> R1.in #purple [line]
R1.out -> TO.in #amber [line]
```

<!-- /schemd-section -->
