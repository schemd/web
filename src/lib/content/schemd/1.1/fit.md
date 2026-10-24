<!-- schemd-doc: id=fit; label=Fit to wires; title=Let a part take its height from its wires; summary=fit=wires lines a gate's rails or a block's pins up with the terminals wired to them, so straight wires stay straight.; category=Author diagrams; order=23 -->

<!-- schemd-section: id=idea; eyebrow=01 / The idea; title=Stop bending wires to meet a fixed pitch; example-title=GHZ state, fitted; example-summary=Two CNOTs whose rails sit on their qubits. -->

A block with several terminals on a side has a fixed pitch. A CNOT's rails are 18 units apart; an IC spreads its pins evenly over its body. Our qubits and buses rarely sit 18 units apart, so every wire bent to meet the part — in to the gate, and out again.

`fit=wires` turns that round. On a part declared with it, each terminal takes the height of the terminal it is wired to, the part is centred between them, and a block's body grows to hold them. The wires arrive straight.

```schemd bounds="900x400" title="GHZ state, fitted"
prepare:Q0 "|0\rangle" at (80, 100) #blue
prepare:Q1 "|0\rangle" at (80, 210) #blue
prepare:Q2 "|0\rangle" at (80, 320) #blue
hadamard:HQ "H" at (230, 100) #cyan
cnot:CA "CNOT" at (420, 150) #purple [fit=wires]
cnot:CB "CNOT" at (600, 260) #purple [fit=wires]
measure:MA "M" at (800, 100) #emerald
measure:MB "M" at (800, 210) #emerald
measure:MC "M" at (800, 320) #emerald

Q0.out -> HQ.in #blue [ortho]
HQ.out -> CA.in1 #cyan [ortho]
Q1.out -> CA.in2 #blue [ortho]
CA.out1 -> MA.in #purple [ortho]
CA.out2 -> CB.in1 #purple [ortho]
Q2.out -> CB.in2 #blue [ortho]
CB.out1 -> MB.in #purple [ortho]
CB.out2 -> MC.in #purple [ortho]
```

Nothing else changes. A document that never writes `fit=wires` compiles to exactly the bytes it did in 1.0.

<!-- /schemd-section -->

<!-- schemd-section: id=what; eyebrow=02 / What lines up; title=Rails on gates, pins on blocks; example-title=Phase oracle block; example-summary=An IC whose three inputs sit on three Hadamard outputs. -->

Two families take the option:

| Part                                                                        | What follows its wires                                                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `cnot`, `cz`, `cphase`, `toffoli`, `controlled`, `swap`, `barrier`, `delay` | one rail per qubit, from its input's wire — or its output's when the input is unwired       |
| `ic` and digital blocks (`mux`, `register`, `counter`, `flipflop`, …)       | the left and right terminals, each side in its declared order; top and bottom stay in place |

A quantum gate's rails may come in **any order**, so a CNOT whose control sits below its target needs nothing special; its two vertical terminals still face away from each other. A block's pins keep the order we declared them in, top to bottom, and its body never shrinks below its usual height.

```schemd bounds="1000x440" title="Phase oracle block"
prepare:R0 "|0\rangle" at (80, 110) #blue
prepare:R1 "|0\rangle" at (80, 220) #blue
prepare:R2 "|1\rangle" at (80, 330) #blue
hadamard:HA "H" at (240, 110) #cyan
hadamard:HB "H" at (240, 220) #cyan
hadamard:HC "H" at (240, 330) #cyan
ic:UF "U_f" at (500, 220) #purple [left="x0,x1,y" right="x0o,x1o,yo" fit=wires]
measure:MX0 "M" at (800, 110) #emerald
measure:MX1 "M" at (800, 220) #emerald

R0.out -> HA.in #blue [ortho]
R1.out -> HB.in #blue [ortho]
R2.out -> HC.in #blue [ortho]
HA.out -> UF.x0 #cyan [ortho]
HB.out -> UF.x1 #cyan [ortho]
HC.out -> UF.y #cyan [ortho]
UF.x0o -> MX0.in #purple [ortho]
UF.x1o -> MX1.in #purple [ortho]
```

The unwired `yo` pin is spaced from its wired neighbours at the block's usual pitch. A part with nothing wired to the terminals that fit keeps its usual shape, so adding `fit=wires` to a part we have not wired yet is harmless.

<!-- /schemd-section -->

<!-- schemd-section: id=rules; eyebrow=03 / Determinism; title=Settled left to right, never by source order; example-title=Upside-down control; example-summary=The control rail sits below the target; no extra syntax. -->

Fitting is arithmetic, not search, and its rules are short:

- **Fitted parts settle left to right**, then top to bottom, then by id. Each one reads only parts already settled, so a chain of gates fits from its first gate onwards — the second CNOT in the GHZ circuit reads the first one's fitted rail.
- **A terminal wired to several parts follows the nearest**, then the higher, then the first by name.
- **The part's centre is derived.** It sits halfway between its outermost wired terminals, so the `y` we wrote matters only while nothing is wired.
- **Placement runs first.** A part placed relative to a fitted one is measured from its unfitted shape, so leave room for it to grow, or place its neighbours with `at (x, y)`.

Reordering the lines of a document never changes its drawing.

```schemd bounds="820x340" title="Upside-down control"
prepare:QT "|0\rangle" at (90, 110) #blue
prepare:QC "|1\rangle" at (90, 240) #blue
cnot:CU "CNOT" at (420, 175) #purple [fit=wires]
port:OT "target" at (740, 110) #emerald
port:OC "control" at (740, 240) #emerald

QC.out -> CU.in1 #blue [ortho]
QT.out -> CU.in2 #blue [ortho]
CU.out1 -> OC.in #purple [ortho]
CU.out2 -> OT.in #purple [ortho]
```

The compiled part records where its terminals landed: `rails` on a fitted gate and `rows` on a fitted block, as offsets from its centre. Full-mode markup carries `data-fit="wires"`, and [`parseSchematicSvg`](/docs/1.1/reading-back) reads it back as `[fit=wires]`.

<!-- /schemd-section -->

<!-- schemd-section: id=limits; eyebrow=04 / When it cannot; title=An impossible fit says what would work; example-title=Aligned by terminal; example-summary=A gate placed so its own in2 sits level with the resistor. -->

Two terminals must arrive at least 16 units apart, and a block's must arrive in the order its pins are declared. When they do not, the diagnostic names the terminal and the height that would work:

| We wrote                                       | It says                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Two pins fed 10 units apart                    | `U1 cannot line up q with its wire: it arrives 10 units below p's, and pins need at least 16. Move the wire on q to y >= 216, or remove fit=wires.`                            |
| Pins fed in the wrong order                    | `U1 cannot line up i1 with its wire: it arrives at y=100, above i0's at y=200, but i1 sits below i0 on U1's left side. Swap the wires, reorder the pins, or remove fit=wires.` |
| `fit=wires` with `orientation`                 | `fit=wires lines terminals up with their wires vertically; remove orientation or fit.`                                                                                         |
| `fit=wires` on a part with one terminal a side | `Option fit is not supported for measure; it lines up the rails of a gate that spans several qubits.`                                                                          |

Fitting is for parts that span several wires. For a part with one terminal a side, line up the terminal itself: an alignment written `at PORT` places the part so its own terminal, not its centre, sits level with the reference. More on that in [placement](/docs/1.1/placement#terminals).

```schemd bounds="760x320" title="Aligned by terminal"
port:SIG "SIG" at (90, 170) #blue
resistor:RIN "10 k\Omega" right-of SIG by 110 #amber
xnor:GX "XNOR" right-of RIN by 110 aligned-y with RIN.out at in2 #purple [inputs=2]
port:OUTX "Y" right-of GX by 110 #emerald

SIG.out -> RIN.in #blue [ortho]
RIN.out -> GX.in2 #amber [ortho]
GX.out1 -> OUTX.in #purple [ortho]
```

<!-- /schemd-section -->
