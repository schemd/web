<!-- schemd-doc: id=nets; label=Nets and junctions; title=Route nets, not wires; summary=How 1.0 decides where wires go: every net is one tree, junctions are where you put them, and contact on the page always means contact in the circuit.; category=Author diagrams; order=22 -->

<!-- schemd-section: id=trees; eyebrow=01 / Trees; title=A net is a tree; example-title=Divider tap; example-summary=R1's output reaches R2 and C1: one net, one tree, one dot. -->

Connections that share a terminal belong to one net, and 1.0 routes the net rather than each connection. The first connection runs terminal to terminal; every later one leaves the nearest copper the net already has, and the point where it leaves gets a junction dot. No net is ever drawn as two wires that happen to lie on top of each other, and no two wires of one net meet at a T without a dot.

Nothing in the source says where a branch goes. It falls out of the geometry — the order of growth is taken from where terminals sit, never from the order we wrote the lines — so reordering a document cannot change its drawing.

```schemd bounds="640x360" title="Divider tap"
source:V1 "5 V" at (110, 200) #blue [type=voltage-dc orientation=up]
resistor:R1 "1 k\Omega" at (300, 120) #amber
resistor:R2 "2 k\Omega" at (500, 120) #amber
capacitor:C1 "10 nF" at (400, 240) #cyan [orientation=down]

V1.positive -> R1.in #blue [ortho]
R1.out -> R2.in #amber [ortho]
R1.out -> C1.in #amber [ortho]
```

`trunk` is still accepted and recorded as `connection.trunk`, so 0.8 sources keep compiling, but the drawing no longer depends on it: a net without it is drawn the same tree.

<!-- /schemd-section -->

<!-- schemd-section: id=junctions; eyebrow=02 / Junctions; title=Put the junction where it belongs; example-title=Three wires, one dot; example-summary=Every wire written to N1 runs straight into it. -->

When a branch belongs somewhere in particular, we put a `junction` there. Wires written to its `node` run straight into it from any side, and its own dot is the junction — no extra dots appear beside it. Its designator and label sit up and to the right of the dot, clear of all four exits, so a wire never has to dodge the junction's own name.

```schemd bounds="700x380" title="Three wires, one dot"
resistor:RA "a" at (190, 170) #amber
junction:N1 "V_{mid}" at (360, 170) #amber
resistor:RB "b" at (530, 170) #amber
capacitor:CB "c" at (360, 290) #cyan [orientation=down]

RA.out -> N1.node #amber [ortho]
N1.node -> RB.in #amber [ortho]
N1.node -> CB.in #amber [ortho]
```

A junction has four sides. A fifth wire written to it is not an error: it joins the net's copper beside the junction instead, with a dot of its own. And whatever we place relative to a junction lands exactly where it always did — placement measures from the junction's centred text rows, not from the text it now draws beside the dot.

<!-- /schemd-section -->

<!-- schemd-section: id=contact; eyebrow=03 / Contact; title=Contact on the page is contact in the circuit; example-title=Strobe across a bus; example-summary=One net dotted where it crosses itself; another bridges over it. -->

Separate nets never touch. Where an orthogonal wire's vertical run crosses another net, the vertical run carries a small bridge and horizontal runs stay straight; an arc beside a neighbouring wire shrinks to half the gap rather than bulging into it. A pin's lead counts as contact along its whole length, so no wire crosses one beside its pin, and a wire never runs through a terminal nothing is wired to.

Wires of the same net that cross are one node, so that crossing is marked with a dot instead of a bridge. The routed result lists those points as `joins`, beside the `junction` a branch reports where it leaves its net's copper.

```schemd bounds="760x470" title="Strobe across a bus"
port:A0 "A_0" at (100, 180) #emerald
port:A0O "A_0'" at (640, 180) #emerald
port:A1 "A_1" at (100, 280) #emerald
port:A1O "A_1'" at (640, 280) #emerald
port:TIE "tie" at (280, 75) #emerald [orientation=down]
port:TIEO "tie'" at (280, 390) #emerald [orientation=up]
port:STB "STB" at (460, 75) #rose [orientation=down]
port:STBO "STB'" at (460, 390) #rose [orientation=up]

A0.out -> A0O.in #emerald [ortho net=ADDR]
A1.out -> A1O.in #emerald [ortho net=ADDR]
TIE.out -> TIEO.out #emerald [ortho net=ADDR]
STB.out -> STBO.out #rose [ortho net=STROBE]
```

A line or Bézier wire cannot be routed around anything, so one drawn through another part's terminal is rejected — it would read as a connection it is not — and the diagnostic says to use an orthogonal route or move the part.

<!-- /schemd-section -->

<!-- schemd-section: id=negotiation; eyebrow=04 / Negotiation; title=Contention is negotiated, in integers; example-title=Around the shield; example-summary=RF goes round the can on the free side, clear of the enable line. -->

Every net is routed once on a lattice of channel-pitch lines plus the coordinates that matter — obstacle edges, pins, and the points where wires leave them — in an order derived from geometry. Contact between nets is forbidden on that first pass, and most documents finish there.

A net that cannot be placed that way is placed at a price, and the router negotiates: the nets in contact are torn up and rerouted with the price raised and a history cost on every location contested before. Every cost is an integer and every coordinate an integer milli-unit, so the result is exact and identical on every engine. `routing.attempts` counts the negotiation rounds, `routing.rippedUp` the wires torn up in them, and `routingAttempts: 1` forbids contact outright.

```schemd bounds="760x360" title="Around the shield"
port:P1 "RF_{in}" at (90, 150) #amber
component:SH "shield can" at (380, 150) #slate [width=170 height=90]
port:Q1 "RF_{out}" at (670, 150) #amber
port:P2 "EN" at (90, 290) #blue
port:Q2 "EN'" at (670, 290) #blue

P1.out -> Q1.in #amber [ortho]
P2.out -> Q2.in #blue [ortho]
```

When a document cannot be routed at all, the error names the wire that could not be placed and what to change — move one of the parts apart, widen the fence, or join the traces that meet with a shared net. Two nets whose leads touch are named as such rather than reported as a routing failure, and a lead that runs into another part, or into a terminal nothing is wired to, names both parts.

<!-- /schemd-section -->
