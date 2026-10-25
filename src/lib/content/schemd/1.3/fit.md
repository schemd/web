<!-- schemd-doc: id=fit; label=Fit to wires; title=Let a part take its height from its wires; summary=fit=wires lines a gate's rails or a block's pins up with the terminals wired to them, so straight wires stay straight.; category=Author diagrams; order=23 -->

<!-- schemd-section: id=idea; eyebrow=01 / The idea; title=Stop bending wires to meet a fixed pitch; example-title=Repetition encoder, fitted; example-summary=Two CNOTs whose rails sit on the qubits they join. -->

A block with several terminals on one side has a fixed pitch. A CNOT's rails are 18 units apart, and an IC spreads its pins evenly over its body. Qubits and buses are seldom 18 units apart, so every wire used to bend to meet the part on the way in and again on the way out.

`fit=wires` reverses that. On a part declared with it, each terminal takes the height of the terminal it is wired to. The part is centred between them, and a block's body grows to hold them. Hence the wires arrive straight.

```schemd bounds="900x420" title="Repetition encoder, fitted"
prepare:A1 "|0\rangle" at (80, 100) #blue
prepare:DQ "|\phi\rangle" at (80, 220) #blue
prepare:A2 "|0\rangle" at (80, 340) #blue
cnot:EA at (380, 160) #purple [fit=wires]
cnot:EB at (580, 280) #purple [fit=wires]
port:Q1 "q_1" at (800, 100) #emerald
port:Q0 "q_0" at (800, 220) #emerald
port:Q2 "q_2" at (800, 340) #emerald

DQ.out -> EA.in1 #blue [ortho]
A1.out -> EA.in2 #blue [ortho]
EA.out2 -> Q1.in #purple [ortho]
EA.out1 -> EB.in1 #purple [ortho]
A2.out -> EB.in2 #blue [ortho]
EB.out1 -> Q0.in #purple [ortho]
EB.out2 -> Q2.in #purple [ortho]
```

Both CNOTs copy the data qubit `DQ` onto an ancilla, which spreads one logical bit over three qubits. A document that never writes `fit=wires` compiles to exactly the bytes it did in 1.0.

<!-- /schemd-section -->

<!-- schemd-section: id=what; eyebrow=02 / What lines up; title=Rails on gates, pins on blocks; example-title=Two-bit oracle block; example-summary=An IC whose three inputs sit on three Hadamard outputs. -->

Two families accept the option:

| Part                                                                          | What follows its wires                                                                                      |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `cnot`, `cz`, `cphase`, `toffoli`, `controlled`, `swap`, `barrier`, `delay`   | one rail per qubit, from the wire on its input, or on its output when the input has none                    |
| `ic` and digital blocks (`mux`, `register`, `counter`, `flipflop` and others) | the left and right terminals, each side in its declared order; top and bottom terminals stay where they are |

A quantum gate's rails may come in any order. A CNOT whose control sits below its target needs nothing special, and its two vertical terminals still face away from each other. A block's pins keep the order in which they were declared, from top to bottom, and its body never shrinks below its usual height.

```schemd bounds="920x450" title="Two-bit oracle block"
prepare:XA "|0\rangle" at (80, 110) #blue
prepare:XB "|0\rangle" at (80, 230) #blue
prepare:TG "|1\rangle" at (80, 350) #blue
hadamard:HA at (230, 110) #cyan
hadamard:HB at (230, 230) #cyan
hadamard:HT at (230, 350) #cyan
ic:UG "U_g" at (500, 230) #purple [left="a,b,t" right="ao,bo,to" fit=wires]
measure:MA at (800, 110) #emerald
measure:MB at (800, 230) #emerald

XA.out -> HA.in #blue [ortho]
XB.out -> HB.in #blue [ortho]
TG.out -> HT.in #blue [ortho]
HA.out -> UG.a #cyan [ortho]
HB.out -> UG.b #cyan [ortho]
HT.out -> UG.t #cyan [ortho]
UG.ao -> MA.in #purple [ortho]
UG.bo -> MB.in #purple [ortho]
```

The unwired `to` pin is spaced from its wired neighbour at the block's usual pitch. A part with nothing wired to the terminals that fit keeps its usual shape, so `fit=wires` can be written on a part before its wires exist. The Hadamards and measurements here carry no labels, since each symbol already says what it is.

<!-- /schemd-section -->

<!-- schemd-section: id=rules; eyebrow=03 / Determinism; title=Settled left to right, never by source order; example-title=Control under the target; example-summary=The control rail sits below the target, with no extra syntax. -->

Fitting is arithmetic and involves no search. Its rules are short:

- Fitted parts settle from left to right, then from top to bottom, then by ID. Each one reads only the parts already settled, so a chain of gates fits from its first gate onwards. In the encoder figure, `EB` reads the rail that `EA` has already fitted.
- A terminal wired to several parts follows the nearest one, then the higher one, then the first by name.
- The centre of the part is derived. It sits halfway between its outermost wired terminals, so the `y` written in the declaration matters only while nothing is wired.
- Placement runs first. A part placed relative to a fitted one is measured from its unfitted shape. Its neighbours therefore need room for it to grow, or they can be placed with `at (x, y)`.

Reordering the lines of a document never changes its drawing.

```schemd bounds="840x400" title="Control under the target"
prepare:TQ "|0\rangle" at (90, 110) #blue
prepare:CQ "|1\rangle" at (90, 300) #blue
cnot:CB at (420, 205) #purple [fit=wires]
port:TOUT "target" at (740, 110) #emerald
port:COUT "control" at (740, 300) #emerald

CQ.out -> CB.in1 #blue [ortho]
TQ.out -> CB.in2 #blue [ortho]
CB.out1 -> COUT.in #purple [ortho]
CB.out2 -> TOUT.in #purple [ortho]
```

The compiled part records where its terminals landed, as offsets from its centre: `rails` on a fitted gate and `rows` on a fitted block. Markup in `full` mode carries `data-fit="wires"`, and [`parseSchematicSvg`](/docs/1.3/reading-back) reads it back as `[fit=wires]`.

<!-- /schemd-section -->

<!-- schemd-section: id=limits; eyebrow=04 / When it cannot; title=An impossible fit says what would work; example-title=Lined up by its second input; example-summary=A gate placed so that its own in2 sits level with the diode. -->

Two terminals must arrive at least 16 units apart, and a block's terminals must arrive in the order its pins are declared. When they do not, the diagnostic names the terminal and gives a height that would work:

| Written                                        | Reported                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Two pins fed 10 units apart                    | `U1 cannot line up q with its wire: it arrives 10 units below p's, and pins need at least 16. Move the wire on q to y >= 216, or remove fit=wires.`                            |
| Pins fed in the wrong order                    | `U1 cannot line up i1 with its wire: it arrives at y=100, above i0's at y=200, but i1 sits below i0 on U1's left side. Swap the wires, reorder the pins, or remove fit=wires.` |
| `fit=wires` with `orientation`                 | `fit=wires lines terminals up with their wires vertically; remove orientation or fit.`                                                                                         |
| `fit=wires` on a part with one terminal a side | `Option fit is not supported for measure; it lines up the rails of a gate that spans several qubits.`                                                                          |

Fitting is meant for parts that span several wires. A part with one terminal on each side is lined up by that terminal. An alignment written `at PORT` places the part so that its own terminal sits level with the reference, where a plain alignment would use the part's centre. The [placement](/docs/1.3/placement#terminals) page explains it in full.

```schemd bounds="800x360" title="Lined up by its second input"
port:SRC "IN" at (90, 200) #blue
diode:DF "clamp" right-of SRC by 110 #rose
xor:GQ "XOR" right-of DF by 110 aligned-y with DF.cathode at in2 #purple [inputs=2]
port:QX "Y" right-of GQ by 110 #emerald

SRC.out -> DF.anode #blue [ortho]
DF.cathode -> GQ.in2 #rose [ortho]
GQ.out1 -> QX.in #purple [ortho]
```

<!-- /schemd-section -->
