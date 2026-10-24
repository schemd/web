<!-- schemd-doc: id=nets; label=Nets and junctions; title=Route nets, not wires; summary=How the compiler decides where wires go: every net is one tree, junctions are where you put them, and contact on the page always means contact in the circuit.; category=Author diagrams; order=22 -->

<!-- schemd-section: id=trees; eyebrow=01 / Trees; title=A net is a tree; example-title=Bias tap; example-summary=RT's output reaches RU and CT: one net, one tree, one dot. -->

Connections that share a terminal belong to one net, and the compiler routes the net rather than each connection. The first connection runs terminal to terminal; every later one leaves the nearest copper the net already has, and the point where it leaves gets a junction dot. No net is ever drawn as two wires that happen to lie on top of each other, and no two wires of one net meet at a T without a dot.

Nothing in the source says where a branch goes. It falls out of the geometry — the order of growth is taken from where terminals sit, never from the order we wrote the lines — so reordering a document cannot change its drawing.

```schemd bounds="640x360" title="Bias tap"
source:V2 "12 V" at (110, 200) #blue [type=voltage-dc orientation=up]
resistor:RT "10 k\Omega" at (300, 120) #amber
resistor:RU "4.7 k\Omega" at (500, 120) #amber
capacitor:CT "100 nF" at (400, 240) #cyan [orientation=down]

V2.positive -> RT.in #blue [ortho]
RT.out -> RU.in #amber [ortho]
RT.out -> CT.in #amber [ortho]
```

`trunk` is still accepted and recorded as `connection.trunk`, so 0.8 sources keep compiling, but the drawing no longer depends on it: a net without it is drawn the same tree.

<!-- /schemd-section -->

<!-- schemd-section: id=junctions; eyebrow=02 / Junctions; title=Put the junction where it belongs; example-title=One node, three branches; example-summary=Every wire written to N2 runs straight into it. -->

When a branch belongs somewhere in particular, we put a `junction` there. Wires written to its `node` run straight into it from any side, and its own dot is the junction — no extra dots appear beside it. Its designator and label sit up and to the right of the dot, clear of all four exits, so a wire never has to dodge the junction's own name.

```schemd bounds="700x380" title="One node, three branches"
inductor:LA2 "L_a" at (190, 170) #purple
junction:N2 "V_{x}" at (360, 170) #purple
resistor:RX "R_x" at (530, 170) #amber
capacitor:CX2 "C_x" at (360, 290) #cyan [orientation=down]

LA2.out -> N2.node #purple [ortho]
N2.node -> RX.in #purple [ortho]
N2.node -> CX2.in #purple [ortho]
```

A junction has four sides. A fifth wire written to it is not an error: it joins the net's copper beside the junction instead, with a dot of its own. If an earlier wire of the net already runs straight through the junction's dot, the junction is on the tree before anything is written to it, so a connection to it is drawn along that copper and adds no ink. Before 1.0.2 such a connection could draw a small detour loop beside the dot, and before 1.1 connecting the same two junction ends twice on such a net could crash the compiler with a `TypeError`; it is now drawn along the copper like any other repeat. And whatever we place relative to a junction lands exactly where it always did — placement measures from the junction's centred text rows, not from the text it now draws beside the dot.

<!-- /schemd-section -->

<!-- schemd-section: id=contact; eyebrow=03 / Contact; title=Contact on the page is contact in the circuit; example-title=Reset across a data pair; example-summary=One net dotted where it crosses itself; another bridges over it. -->

Separate nets never touch. Where an orthogonal wire's vertical run crosses another net, the vertical run carries a small bridge and horizontal runs stay straight; an arc beside a neighbouring wire shrinks to half the gap rather than bulging into it. A pin's lead counts as contact along its whole length, so no wire crosses one beside its pin, and a wire never runs through a terminal nothing is wired to.

Wires of the same net that cross are one node, so that crossing is marked with a dot instead of a bridge. The routed result lists those points as `joins`, beside the `junction` a branch reports where it leaves its net's copper.

```schemd bounds="760x470" title="Reset across a data pair"
port:DP0 "D_+" at (100, 170) #cyan
port:DP0O "D_+'" at (640, 170) #cyan
port:DP1 "D_-" at (100, 290) #cyan
port:DP1O "D_-'" at (640, 290) #cyan
port:BRG "bridge" at (290, 75) #cyan [orientation=down]
port:BRGO "bridge'" at (290, 395) #cyan [orientation=up]
port:RST "RST" at (470, 75) #amber [orientation=down]
port:RSTO "RST'" at (470, 395) #amber [orientation=up]

DP0.out -> DP0O.in #cyan [ortho net=PAIR]
DP1.out -> DP1O.in #cyan [ortho net=PAIR]
BRG.out -> BRGO.out #cyan [ortho net=PAIR]
RST.out -> RSTO.out #amber [ortho net=RESET]
```

A line or Bézier wire cannot be routed around anything, so one drawn through another part's terminal is rejected — it would read as a connection it is not — and the diagnostic says to use an orthogonal route or move the part.

<!-- /schemd-section -->

<!-- schemd-section: id=negotiation; eyebrow=04 / Negotiation; title=Contention is negotiated, in integers; example-title=Around the heatsink; example-summary=The high-voltage line goes round the heatsink on the free side, clear of the fan line. -->

Every net is routed once on a lattice of channel-pitch lines plus the coordinates that matter — obstacle edges, pins, and the points where wires leave them — in an order derived from geometry. Contact between nets is forbidden on that first pass, and most documents finish there.

A net that cannot be placed that way is placed at a price, and the router negotiates: the nets in contact are torn up and rerouted with the price raised and a history cost on every location contested before. Every cost is an integer and every coordinate an integer milli-unit, so the result is exact and identical on every engine. `routing.attempts` counts the negotiation rounds, `routing.rippedUp` the wires torn up in them, and `routingAttempts: 1` forbids contact outright.

```schemd bounds="760x360" title="Around the heatsink"
port:HP "HV_{in}" at (90, 150) #rose
component:HS "heatsink" at (380, 150) #slate [width=170 height=90]
port:HQ "HV_{out}" at (670, 150) #rose
port:FP "FAN" at (90, 290) #blue
port:FQ "FAN'" at (670, 290) #blue

HP.out -> HQ.in #rose [ortho]
FP.out -> FQ.in #blue [ortho]
```

When a document cannot be routed at all, the error names the wire that could not be placed and what to change — move one of the parts apart, widen the fence, or join the traces that meet with a shared net. Two nets whose leads touch are named as such rather than reported as a routing failure, and a lead that runs into another part, or into a terminal nothing is wired to, names both parts.

<!-- /schemd-section -->
