<!-- schemd-doc: id=placement; label=Placement; title=Place parts by relationship, not by arithmetic; summary=Six relations that resolve to absolute coordinates before anything else runs.; category=Author diagrams; order=25 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->

<!-- schemd-section: id=why; eyebrow=01 / The idea; title=Say where a part sits; example-title=One coordinate, five relations; example-summary=Only VBAT states coordinates. -->

Coordinates are fine for four parts. They are tedious for fourteen, and worse when we move one, because every neighbour we positioned against it needs redoing. So a declaration can state a relationship instead:

```text
kind:ID "label" at (x, y) #color [options]
kind:ID "label" right-of VIN by 150 #color [options]
```

Both forms are first-class and can appear in the same document. If we never write a relation, nothing changes — our diagram compiles to exactly the bytes it did before.

```schemd bounds="900x560" title="Relative placement"
// Only VBAT states coordinates.
source:VBAT "V_{bat}" at (90, 160) #blue [type=battery]
switch:SW1 "power" right-of VBAT by 150 #amber [type=spst]
junction:VDD "V_{dd}" right-of SW1 by 150 #cyan
capacitor:CD "10 \mu F" below VDD by 110 #cyan [type=polarized orientation=down]
port:LOAD "load" right-of VDD by 150 #emerald
ground:GB "0 V" below SW1 by 190 aligned-x with SW1 #slate

VBAT.positive -> SW1.in #blue [ortho]
SW1.out -> VDD.node #amber [ortho]
VDD.node -> CD.in #cyan [ortho]
VDD.node -> LOAD.in #emerald [ortho marker-end=arrow]
CD.out -> GB.in #cyan [ortho]
VBAT.negative -> GB.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=relations; eyebrow=02 / Vocabulary; title=Four directions, two alignments; example-title=Anchored to a part; example-summary=`aligned-y with BP` lines the gate's centre up with the port. -->

There are six relations. Each takes a component or one of its terminals, the four directions take an optional `by` distance, and the two alignments an optional `at` terminal of our own:

| Relation             | Sets                                                 | `by` |
| -------------------- | ---------------------------------------------------- | ---- |
| `right-of REF`       | x, our left edge clear of the reference's right edge | yes  |
| `left-of REF`        | x, our right edge clear of the reference's left edge | yes  |
| `below REF`          | y, our top edge clear of the reference's bottom edge | yes  |
| `above REF`          | y, our bottom edge clear of the reference's top edge | yes  |
| `aligned-x with REF` | x, copied from the reference                         | no   |
| `aligned-y with REF` | y, copied from the reference                         | no   |

Either alignment can end `at PORT` to line up one of our own terminals instead of our origin — the [next section](#terminals) is about that.

Two details matter. A direction measures from the **body**, not the origin, so `by 150` is 150 units of clear space between facing edges — the room we actually asked for, and still correct when the reference is rotated. Omit `by` and we get the axis default: 160 horizontally, 140 vertically.

And an axis that no relation sets is **inherited from the first reference**, so `right-of A` puts us beside A and level with it. An alignment overrides that, which is how a part takes its column from one component and its row from another:

```schemd bounds="880x520" title="Anchored to a part"
port:BP "B" at (140, 160) #blue
nor:GN "NOR" right-of BP by 200 aligned-y with BP #purple
port:QP "Q" right-of GN by 200 #emerald
clock:CLKN "CLK" below GN by 150 aligned-x with GN #amber

BP.out -> GN.in1 #blue [ortho]
CLKN.out -> GN.in2 #amber [ortho]
GN.out -> QP.in #purple [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=terminals; eyebrow=03 / Terminals; title=Line up a terminal, not a centre; example-title=Terminal to terminal; example-summary=Each gate is placed so its in2 sits level with the wire that feeds it. -->

An alignment copies a coordinate onto our **origin**. That is right for a resistor, whose pins sit on its centre line, and wrong for a gate, whose second input sits below its centre: `aligned-y with R.out` leaves that input off the wire, and the wire jogs to reach it.

So since 1.1 an alignment can name one of our own terminals with `at`:

```text
and:G2 "G" right-of R2 by 80 aligned-y with R2.out at in2 #blue [inputs=2]
```

The part lands wherever puts its `in2` level with `R2.out`. Either side may be a terminal: `REF.port` measures from the reference's terminal, `at PORT` from ours. The terminal is folded to its canonical name, so `at out` on a gate is reported as `out1`, and one the part does not have is reported with its line: `R1 has no terminal named nowhere to line up with G1. Name one of R1's terminals, or remove at nowhere to align its centre.`

For a part that spans several wires — a CNOT, an IC — lining up one terminal is not enough. That is what [`fit=wires`](/docs/1.1/fit) is for.

```schemd bounds="900x420" title="Terminal to terminal"
port:IA "a" at (100, 130) #blue
resistor:RA2 "1 k\Omega" right-of IA by 100 #amber
and:GA "AND" right-of RA2 by 100 aligned-y with RA2.out at in2 #purple [inputs=2]
port:IB "b" at (100, 300) #blue
resistor:RB2 "1 k\Omega" right-of IB by 100 #amber
or:GB2 "OR" right-of RB2 by 100 aligned-y with RB2.out at in2 #purple [inputs=2]

IA.out -> RA2.in #blue [ortho]
RA2.out -> GA.in2 #amber [ortho]
IB.out -> RB2.in #blue [ortho]
RB2.out -> GB2.in2 #amber [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=04 / How it works; title=Relations resolve before anything else sees them; example-title=Mixed forms; example-summary=Absolute and relative declarations, resolved together. -->

This is not a layout engine. It never decides where a part goes — every coordinate follows from a relation we wrote. Relations resolve to one `at (x, y)` _before the AST is finished_, so the netlist, the design rules, the source map, and the renderer never learn relative placement exists. The compiler's test suite pins that: a relative document and the absolute one it resolves to compile to byte-identical SVG.

Resolution is one topological sort and one pass of arithmetic — no solver, no iteration. So:

- **Forward references work.** We can place a part against one declared further down.
- **A cycle is an error**, and the diagnostic names its members: `Placement cycle: A -> C -> B -> A.`
- **Order of evaluation cannot affect the result.** A position depends only on its references' positions.

```schemd bounds="900x600" title="Mixed forms"
source:VGG "V_{gg}" at (110, 300) #purple [type=voltage-dc]
resistor:RG "100 k\Omega" right-of VGG by 130 #cyan
transistor:MN "2N7000" right-of RG by 130 #blue [type=nmos]
resistor:RD "470 \Omega" above MN by 80 aligned-x with MN #cyan [orientation=down]
ground:SGND "0 V" at (560, 510) #slate

VGG.positive -> RG.in #purple [ortho]
RG.out -> MN.gate #cyan [ortho]
RD.out -> MN.drain #cyan [ortho]
MN.source -> SGND.in #slate [ortho]
VGG.negative -> SGND.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=budget; eyebrow=05 / When it goes wrong; title=Every mistake names its line and its fix; example-title=Reading the resolved coordinates; example-summary=`placements` reports what each relation worked out to. -->

`limits.placementDepth` caps how long a chain may be, and defaults to 64. Every diagnostic carries its line:

| We wrote                            | It says                                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A reference to something undeclared | `B is placed relative to R9, which the document never declares. Declare R9 anywhere in the document, or place B with at (x, y).` |
| A part placed against itself        | `B is placed relative to itself. Reference another declaration, or place it with at (x, y).`                                     |
| A cycle                             | `Placement cycle: A -> B -> C -> A. One component in a cycle must be placed with at (x, y).`                                     |
| `by -80`                            | `B states a negative by distance of -80. Distances are unsigned; use the opposite direction instead.`                            |
| A terminal that does not exist      | `A has no terminal named clock, so B cannot be placed against it. Reference A itself, or name a terminal it declares.`           |
| An `at` terminal we do not have     | `B has no terminal named clock to line up with A. Name one of B's terminals, or remove at clock to align its centre.`            |
| Too long a chain                    | `P5 sits 5 placements deep, past the 4 chain budget. Anchor one component in the chain with at (x, y).`                          |

[`diagnoseSchematic`](/docs/1.1/diagnostics) reports every broken relation at once, each at the columns of the reference at fault, and a cycle once, at its first stuck line; nothing placed against a broken declaration is blamed again. Since 1.0.2 that includes a declaration whose own line failed, such as one with an unknown option: what is placed against it is left unplaced, not reported as referencing something undeclared. Placement arithmetic is in integer milli-units, so a relation and its mirror image land exactly opposite each other.

A relation that pushes a part off the canvas is not a new kind of error — it reaches the same out-of-bounds diagnostic a bad `at (x, y)` would, naming a coordinate that fits.

The compilation carries the resolved numbers:

```ts
const { placements } = compileSchematic(source, fence);
// [{ id: 'R1', line: 3, resolved: { x: 332, y: 150 },
//    relations: [{ kind: 'right-of', ref: 'VIN', gap: 150 }] }, …]
```

It is empty when we used only coordinates, sorted by source line, and its relations carry canonical terminal names, so a reported relation always agrees with the netlist. The [inspector](/inspector/1.1.0) shows it in its Place stage.

```schemd bounds="960x400" title="Reading the resolved coordinates"
port:IN2 "in" at (120, 200) #violet
inductor:LA "L" right-of IN2 by 160 #purple
inductor:LB "L" right-of LA by 160 #cyan
port:OUT2 "out" right-of LB by 160 #emerald

IN2.out -> LA.in #violet [line]
LA.out -> LB.in #purple [line]
LB.out -> OUT2.in #emerald [line]
```

<!-- /schemd-section -->
