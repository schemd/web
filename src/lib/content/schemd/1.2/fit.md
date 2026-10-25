<!-- schemd-doc: id=fit; label=Fit to wires; title=Let a part take its height from its wires; summary=fit=wires lines a gate's rails or a block's pins up with the terminals wired to them, so straight wires stay straight.; category=Author diagrams; order=23 -->

<!-- schemd-section: id=idea; eyebrow=01 / The idea; title=Stop bending wires to meet a fixed pitch; example-title=Parity onto an ancilla, fitted; example-summary=Two CNOTs whose rails sit on the qubits they join. -->

A block with several terminals on one side has a fixed pitch. A CNOT's rails are 18 units apart, and an IC spreads its pins evenly over its body. Qubits and buses are seldom 18 units apart, so every wire used to bend to meet the part on the way in and again on the way out.

`fit=wires` reverses that. On a part declared with it, each terminal takes the height of the terminal it is wired to. The part is centred between them, and a block's body grows to hold them. Hence the wires arrive straight.

```schemd bounds="900x420" title="Parity onto an ancilla, fitted"
prepare:D0 "|0\rangle" at (80, 100) #blue
prepare:AN "|0\rangle" at (80, 220) #blue
prepare:D1 "|1\rangle" at (80, 340) #blue
cnot:PA at (380, 160) #purple [fit=wires]
cnot:PB at (580, 280) #purple [fit=wires]
port:O0 "d_0" at (800, 100) #emerald
measure:MP "parity" at (800, 220) #emerald
port:O1 "d_1" at (800, 340) #emerald

D0.out -> PA.in1 #blue [ortho]
AN.out -> PA.in2 #blue [ortho]
PA.out1 -> O0.in #purple [ortho]
D1.out -> PB.in1 #blue [ortho]
PA.out2 -> PB.in2 #purple [ortho]
PB.out1 -> O1.in #purple [ortho]
PB.out2 -> MP.in #purple [ortho]
```

Both CNOTs write into the ancilla `AN`, so its measurement gives the parity of `d_0` and `d_1`. A document that never writes `fit=wires` compiles to exactly the bytes it did in 1.0.

<!-- /schemd-section -->

<!-- schemd-section: id=what; eyebrow=02 / What lines up; title=Rails on gates, pins on blocks; example-title=Three-bit oracle block; example-summary=An IC whose four inputs sit on four Hadamard outputs. -->

Two families accept the option:

| Part                                                                          | What follows its wires                                                                                      |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `cnot`, `cz`, `cphase`, `toffoli`, `controlled`, `swap`, `barrier`, `delay`   | one rail per qubit, from the wire on its input, or on its output when the input has none                    |
| `ic` and digital blocks (`mux`, `register`, `counter`, `flipflop` and others) | the left and right terminals, each side in its declared order; top and bottom terminals stay where they are |

A quantum gate's rails may come in any order. A CNOT whose control sits below its target needs nothing special, and its two vertical terminals still face away from each other. A block's pins keep the order in which they were declared, from top to bottom, and its body never shrinks below its usual height.

```schemd bounds="920x500" title="Three-bit oracle block"
prepare:X0 "|0\rangle" at (80, 100) #blue
prepare:X1 "|0\rangle" at (80, 200) #blue
prepare:X2 "|0\rangle" at (80, 300) #blue
prepare:YQ "|1\rangle" at (80, 400) #blue
hadamard:H0 at (230, 100) #cyan
hadamard:H1 at (230, 200) #cyan
hadamard:H2 at (230, 300) #cyan
hadamard:HY at (230, 400) #cyan
ic:OR "U_f" at (500, 250) #purple [left="a,b,c,y" right="ao,bo,co,yo" fit=wires]
measure:M0 at (800, 100) #emerald
measure:M1 at (800, 200) #emerald
measure:M2 at (800, 300) #emerald

X0.out -> H0.in #blue [ortho]
X1.out -> H1.in #blue [ortho]
X2.out -> H2.in #blue [ortho]
YQ.out -> HY.in #blue [ortho]
H0.out -> OR.a #cyan [ortho]
H1.out -> OR.b #cyan [ortho]
H2.out -> OR.c #cyan [ortho]
HY.out -> OR.y #cyan [ortho]
OR.ao -> M0.in #purple [ortho]
OR.bo -> M1.in #purple [ortho]
OR.co -> M2.in #purple [ortho]
```

The unwired `yo` pin is spaced from its wired neighbour at the block's usual pitch. A part with nothing wired to the terminals that fit keeps its usual shape, so `fit=wires` can be written on a part before its wires exist. The Hadamards and measurements here carry no labels, since each symbol already says what it is.

<!-- /schemd-section -->

<!-- schemd-section: id=rules; eyebrow=03 / Determinism; title=Settled left to right, never by source order; example-title=Control below its target; example-summary=The control rail sits below the target, with no extra syntax. -->

Fitting is arithmetic and involves no search. Its rules are short:

- Fitted parts settle from left to right, then from top to bottom, then by ID. Each one reads only the parts already settled, so a chain of gates fits from its first gate onwards. In the parity figure, `PB` reads the rail that `PA` has already fitted.
- A terminal wired to several parts follows the nearest one, then the higher one, then the first by name.
- The centre of the part is derived. It sits halfway between its outermost wired terminals, so the `y` written in the declaration matters only while nothing is wired.
- Placement runs first. A part placed relative to a fitted one is measured from its unfitted shape. Its neighbours therefore need room for it to grow, or they can be placed with `at (x, y)`.

Reordering the lines of a document never changes its drawing.

```schemd bounds="820x380" title="Control below its target"
prepare:TG "|+\rangle" at (90, 120) #blue
prepare:CT "|1\rangle" at (90, 280) #blue
cnot:CR at (400, 200) #purple [fit=wires]
port:TO "target" at (720, 120) #emerald
port:CO "control" at (720, 280) #emerald

CT.out -> CR.in1 #blue [ortho]
TG.out -> CR.in2 #blue [ortho]
CR.out1 -> CO.in #purple [ortho]
CR.out2 -> TO.in #purple [ortho]
```

The compiled part records where its terminals landed, as offsets from its centre: `rails` on a fitted gate and `rows` on a fitted block. Markup in `full` mode carries `data-fit="wires"`, and [`parseSchematicSvg`](/docs/1.2/reading-back) reads it back as `[fit=wires]`.

<!-- /schemd-section -->

<!-- schemd-section: id=limits; eyebrow=04 / When it cannot; title=An impossible fit says what would work; example-title=Lined up by its first input; example-summary=A gate placed so that its own in1 sits level with the capacitor. -->

Two terminals must arrive at least 16 units apart, and a block's terminals must arrive in the order its pins are declared. When they do not, the diagnostic names the terminal and gives a height that would work:

| Written                                        | Reported                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Two pins fed 10 units apart                    | `U1 cannot line up q with its wire: it arrives 10 units below p's, and pins need at least 16. Move the wire on q to y >= 216, or remove fit=wires.`                            |
| Pins fed in the wrong order                    | `U1 cannot line up i1 with its wire: it arrives at y=100, above i0's at y=200, but i1 sits below i0 on U1's left side. Swap the wires, reorder the pins, or remove fit=wires.` |
| `fit=wires` with `orientation`                 | `fit=wires lines terminals up with their wires vertically; remove orientation or fit.`                                                                                         |
| `fit=wires` on a part with one terminal a side | `Option fit is not supported for measure; it lines up the rails of a gate that spans several qubits.`                                                                          |

Fitting is meant for parts that span several wires. A part with one terminal on each side is lined up by that terminal. An alignment written `at PORT` places the part so that its own terminal sits level with the reference, where a plain alignment would use the part's centre. The [placement](/docs/1.2/placement#terminals) page explains it in full.

```schemd bounds="780x340" title="Lined up by its first input"
port:IN "IN" at (90, 190) #blue
capacitor:CC "100 nF" right-of IN by 110 #cyan
nand:GN "NAND" right-of CC by 110 aligned-y with CC.out at in1 #purple [inputs=2]
port:OUTN "Q" right-of GN by 110 #emerald

IN.out -> CC.in #blue [ortho]
CC.out -> GN.in1 #cyan [ortho]
GN.out1 -> OUTN.in #purple [ortho]
```

<!-- /schemd-section -->
