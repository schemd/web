<!-- schemd-doc: id=nets; label=Nets and junctions; title=Route nets, not wires; summary=How the compiler decides where wires go: every net is one tree, junctions are where you put them, and contact on the page always means contact in the circuit.; category=Author diagrams; order=22 -->

<!-- schemd-section: id=trees; eyebrow=01 / Trees; title=A net is a tree; example-title=One branch off a resistor; example-summary=RX's output reaches DX and CX: one net, one tree, one dot. -->

Connections that share a terminal belong to one net, and the compiler routes the net as a whole. The first connection runs from terminal to terminal. Each later one leaves the nearest copper the net already has, and the point where it leaves gets a junction dot. A net is never drawn as two wires lying on top of each other, and two wires of one net never meet at a T without a dot.

Nothing in the source says where a branch goes. The order of growth is taken from where the terminals sit and never from the order of the lines, so reordering a document cannot change its drawing.

```schemd bounds="660x380" title="One branch off a resistor"
source:VD "3.3 V" at (110, 210) #blue [type=voltage-dc orientation=up]
resistor:RX "470 \Omega" at (300, 120) #amber
diode:DX "status" at (510, 120) #rose [type=led]
capacitor:CX "1 \mu F" at (410, 250) #cyan [orientation=down]

VD.positive -> RX.in #blue [ortho]
RX.out -> DX.anode #amber [ortho]
RX.out -> CX.in #amber [ortho]
```

`trunk` is still accepted and recorded as `connection.trunk`, so 0.8 sources keep compiling. The drawing no longer depends on it, and a net without it is drawn as the same tree.

<!-- /schemd-section -->

<!-- schemd-section: id=junctions; eyebrow=02 / Junctions; title=Put the junction where it belongs; example-title=A labelled node with three branches; example-summary=Every wire written to ND runs straight into it. -->

When a branch belongs at one particular place, a `junction` is put there. Wires written to its `node` run straight into it from any side, and its own dot is the junction, so no extra dot appears beside it. Its designator and label sit above and to the right of the dot, clear of all four exits. Hence a wire never has to avoid the junction's own name. Since 1.2 the label may be left out, and the junction then shows its designator alone.

```schemd bounds="720x420" title="A labelled node with three branches"
diode:DD "D_r" at (190, 180) #rose
junction:ND "V_{d}" at (370, 180) #rose
port:VDO "out" at (560, 180) #emerald
resistor:RD "R_d" at (370, 310) #amber [orientation=down]

DD.cathode -> ND.node #rose [ortho]
ND.node -> VDO.in #rose [ortho]
ND.node -> RD.in #rose [ortho]
```

A junction has four sides. A fifth wire written to it is no error: it joins the net's copper beside the junction, with a dot of its own. When an earlier wire of the net already runs straight through the junction's dot, the junction is on the tree before anything is written to it. A connection to it is then drawn along that copper and adds no ink. Before 1.0.2 such a connection could draw a small loop beside the dot. In 1.0, connecting the same two junction ends twice on such a net could crash the compiler with a `TypeError`; that repeat is now drawn along the copper like any other.

A part placed relative to a junction lands exactly where it always did. Placement measures from the junction's centred text rows, and the text drawn beside the dot does not move it.

<!-- /schemd-section -->

<!-- schemd-section: id=contact; eyebrow=03 / Contact; title=Contact on the page is contact in the circuit; example-title=Chip select across a bus pair; example-summary=One net is dotted where it crosses itself; another bridges over it. -->

Separate nets never touch. Where the vertical run of an orthogonal wire crosses another net, the vertical run carries a small bridge and the horizontal runs stay straight. Beside a neighbouring wire the arc shrinks to half the gap, so it never bulges into the neighbour. A pin's lead counts as contact along its whole length. No wire crosses one beside its pin, and a wire never runs through a terminal that nothing is wired to.

Wires of the same net that cross are one node, and that crossing is marked with a dot. The routed result lists those points as `joins`, beside the `junction` a branch reports where it leaves its net's copper.

```schemd bounds="780x490" title="Chip select across a bus pair"
port:MOSI "MOSI" at (100, 180) #cyan
port:MOSIO "MOSI'" at (660, 180) #cyan
port:MISO "MISO" at (100, 310) #cyan
port:MISOO "MISO'" at (660, 310) #cyan
port:PRB "probe" at (290, 80) #cyan [orientation=down]
port:PRBO "probe'" at (290, 410) #cyan [orientation=up]
port:CSN "CS" at (470, 80) #amber [orientation=down]
port:CSNO "CS'" at (470, 410) #amber [orientation=up]

MOSI.out -> MOSIO.in #cyan [ortho net=SPI]
MISO.out -> MISOO.in #cyan [ortho net=SPI]
PRB.out -> PRBO.out #cyan [ortho net=SPI]
CSN.out -> CSNO.out #amber [ortho net=CS]
```

The probe line belongs to the bus net, so its two crossings are dots. Its chip-select neighbour belongs to a net of its own and bridges both bus lines.

A line or Bézier wire cannot be routed around anything. One drawn through another part's terminal would read as a connection it is not, so it is rejected, and the diagnostic says to use an orthogonal route or to move the part.

<!-- /schemd-section -->

<!-- schemd-section: id=negotiation; eyebrow=04 / Negotiation; title=Contention is negotiated, in integers; example-title=Around the transformer; example-summary=The supply line goes round the transformer on its free side, clear of the data line. -->

Every net is routed once on a lattice of channel-pitch lines and the coordinates that matter: obstacle edges, pins, and the points where wires leave them. The order comes from the geometry. Contact between nets is forbidden on that first pass, and most documents finish there.

A net that cannot be placed that way is placed at a price, and the router negotiates. The nets in contact are torn up and routed again, with the price raised and a history cost added to every location contested before. Every cost is an integer and every coordinate is an integer milli-unit, so the result is exact and identical on every engine. `routing.attempts` counts the negotiation rounds and `routing.rippedUp` counts the wires torn up in them. `routingAttempts: 1` forbids contact outright.

```schemd bounds="780x380" title="Around the transformer"
port:LP "L_{in}" at (90, 160) #rose
component:TFM "transformer" at (390, 160) #slate [width=170 height=100]
port:LQ "L_{out}" at (690, 160) #rose
port:DP "DATA" at (90, 300) #blue
port:DQ "DATA'" at (690, 300) #blue

LP.out -> LQ.in #rose [ortho]
DP.out -> DQ.in #blue [ortho]
```

When a document cannot be routed at all, the error names the wire that could not be placed and says what to change. The usual remedies are to move two parts apart, to widen the fence, or to join the traces that meet with a shared net. Two nets whose leads touch are reported as touching, which is a different error from a routing failure. A lead that runs into another part, or into a terminal nothing is wired to, names both parts.

<!-- /schemd-section -->
