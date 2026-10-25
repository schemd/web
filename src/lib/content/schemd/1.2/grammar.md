<!-- schemd-doc: id=grammar; label=Grammar; title=Use the strict 1.2 grammar; summary=Place typed nodes, rotate canonical geometry, and connect validated semantic ports.; category=Author diagrams; order=20 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Grammar fragments show one declaration at a time. -->

<!-- schemd-section: id=declarations; eyebrow=01 / Nodes; title=Declare one bounded component per line; example-title=Vertical status LED; example-summary=Orientation rotates the geometry, and the port names stay where they were. -->

Each component is declared on one line:

```text
kind:ID "label" at (x, y) #color [options]
```

Identifiers are case-sensitive, and each one becomes a key in the source map. An option that is unknown, repeated or foreign to the kind is a compile error with a one-based line number.

Since 1.2 the quoted label may be left out. `junction:JA at (380, 360) #cyan` is a complete declaration, and the part draws its designator alone. An empty pair of quotes is still an error, because a label that says nothing should simply not be written.

`orientation` accepts exactly `right`, `down`, `left` or `up`. A part that no rotation can change, such as a `junction`, rejects it outright. Rotation moves the geometry as one piece: the body, its ports, their outward normals, the collision rectangle and the routing corridors. The vocabulary never rotates. A vertical diode is still wired from `anode` to `cathode`, and a vertical source still has a `positive` and a `negative`. Hence rotating a symbol never rewrites the connections around it.

```schemd bounds="800x720" title="Vertical status LED"
source:VCC "3.3 V" at (380, 90) #blue [type=voltage-dc orientation=down]
resistor:RL "220 \Omega" at (380, 240) #amber [orientation=down]
junction:JA at (380, 360) #cyan
diode:LED "status" at (380, 490) #rose [type=led orientation=down]
port:SNS "to ADC" at (660, 360) #emerald
ground:LG at (380, 640) #slate

VCC.positive -> RL.in #blue [ortho]
RL.out -> JA.node #amber [ortho]
JA.node -> LED.anode #rose [ortho]
JA.node -> SNS.in #emerald [ortho marker-end=arrow]
LED.cathode -> LG.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=connections; eyebrow=02 / Wires; title=Connect semantic ports and signal domains; example-title=Six-lane reversal bus; example-summary=Every lane must cross every other; each net is routed once, in an order taken from the geometry. -->

A connection is two terminals joined by an arrow:

```text
A.port -> B.port #color [options]
```

A route is `line`, `bezier` or `ortho`. The signal domains are `electrical`, `digital`, `quantum` and `classical`. A width mismatch is rejected before layout, so it is never drawn as a plausible mistake.

`net=NAME` gives a group of segments one identity. Segments that share an exact `component.port` join without being told, so every branch off one `junction.node` is one net. A name can also join segments that never touch. All the segments of a net must agree on domain and width, and two different names at a shared terminal are an error. A net without a name still gets a stable identity, `$1`, `$2` and so on in source order, and it appears in the AST, the source map and the `data-net-id` of `full`-mode SVG.

Contact on the page always means contact in the circuit. Separate nets never touch: where two of them cross, the vertical run carries a bridge. Wires of one net that cross are one node and get a dot. Bodies may meet at an edge but never overlap. A `line` or `bezier` wire through another part's terminal is rejected, since it would read as a connection. The [nets and junctions](/docs/1.2/nets) page covers each rule.

A reversal bus is the hardest test for the router, because every lane has to cross every other:

```schemd bounds="920x650" title="Six-lane reversal bus"
port:A0 "A_0" at (100, 100) #rose [width=1]
port:A1 "A_1" at (100, 190) #blue [width=1]
port:A2 "A_2" at (100, 280) #amber [width=1]
port:A3 "A_3" at (100, 370) #violet [width=1]
port:A4 "A_4" at (100, 460) #emerald [width=1]
port:A5 "A_5" at (100, 550) #cyan [width=1]
port:B0 "B_0" at (820, 550) #rose [width=1]
port:B1 "B_1" at (820, 460) #blue [width=1]
port:B2 "B_2" at (820, 370) #amber [width=1]
port:B3 "B_3" at (820, 280) #violet [width=1]
port:B4 "B_4" at (820, 190) #emerald [width=1]
port:B5 "B_5" at (820, 100) #cyan [width=1]

A0.out -> B0.in #rose [ortho digital net=L0]
A1.out -> B1.in #blue [ortho digital net=L1]
A2.out -> B2.in #amber [ortho digital net=L2]
A3.out -> B3.in #violet [ortho digital net=L3]
A4.out -> B4.in #emerald [ortho digital net=L4]
A5.out -> B5.in #cyan [ortho digital net=L5]
```

Each net is searched once on a lattice of channel-pitch lines and the coordinates that matter. The order of the search comes from where the terminals sit and never from the order of declaration, and contact between nets is forbidden on that pass. A net that still cannot be placed is placed at a price. The nets it touches are then torn up and routed again, with the price raised and a history cost added to every location contested before. Every cost is an integer, so the result is the same on every JavaScript engine.

`compileSchematic` reports the router's work in `routing`. `attempts` counts the negotiation rounds, `rippedUp` counts the wires torn up in them, and `congestion` gives the load on each lattice cell. A contended twelve-wire bus routes in the first pass in about 1.5 ms. `routing.nudged` is always `false`, because the bundle nudging of 0.7 no longer exists. The [inspector](/inspector/1.2.0) draws the whole report.

<!-- /schemd-section -->

<!-- schemd-section: id=options; eyebrow=03 / Validation; title=Use family options, never untyped attributes; example-title=Named-pin LDO; example-summary=Each pin name becomes an addressable, case-sensitive port. -->

Options are checked by name against the kind they belong to. The common ones are `type`, `orientation`, `inputs`, `outputs`, `width`, `controls`, `targets`, `wires`, `parameter`, `phase`, `matrix`, `operator`, `control` and [`fit`](/docs/1.2/fit). Which kind accepts which option is listed in the [component API](/docs/1.2/component-reference). There is no untyped attribute bag. A misspelt option is therefore a compile error and never a drawing that is quietly wrong.

`ic` shows this best. Its quoted `left`, `right`, `top` and `bottom` lists each become case-sensitive ports, and the body grows to fit its longest side, so the box is never sized by hand:

```schemd bounds="980x520" title="Named-pin LDO"
port:VBAT "V_{bat}" at (90, 180) #blue
capacitor:CIN "10 \mu F" at (250, 330) #cyan [orientation=down]
ic:U4 "LDO" at (480, 240) #cyan [left="IN,EN" right="OUT,PG" bottom="GND"]
port:RAIL "3.3 V" at (860, 210) #emerald
port:PGOOD "power good" at (860, 320) #amber
ground:LG "0 V" at (480, 440) #slate

VBAT.out -> U4.IN #blue [ortho]
VBAT.out -> U4.EN #blue [ortho]
VBAT.out -> CIN.in #blue [ortho]
CIN.out -> LG.in #slate [ortho]
U4.OUT -> RAIL.in #emerald [ortho marker-end=arrow]
U4.PG -> PGOOD.in #amber [ortho]
U4.GND -> LG.in #slate [ortho]
```

Every wire here names a real pin, from `U4.IN` to `U4.GND`. The generic `in` and `out` still resolve to the first suitable input and output when the choice does not matter. On a package with named pins it usually does.

<!-- /schemd-section -->

<!-- schemd-section: id=trunks; eyebrow=04 / Trees; title=Every multi-terminal net is a tree; example-title=Decoupling bank; example-summary=Four capacitors share one supply and one return, each net drawn as a tree with no option at all. -->

A net that reaches several terminals is still written as one connection per terminal, and it is drawn as a tree without being asked. The first connection runs from terminal to terminal. Each later one leaves the nearest copper the net already has, with a dot where it joins. Geometry decides which branch joins where, so reordering the lines changes nothing.

```schemd bounds="940x510" title="Decoupling bank"
port:V5 "5 V" at (90, 110) #blue
capacitor:C1 "100 nF" at (300, 250) #cyan [orientation=down]
capacitor:C2 "100 nF" at (470, 250) #cyan [orientation=down]
capacitor:C3 "1 \mu F" at (640, 250) #cyan [orientation=down]
capacitor:C4 "10 \mu F" at (810, 250) #cyan [type=polarized orientation=down]
ground:RET "0 V" at (120, 430) #slate

V5.out -> C1.in #blue [ortho]
V5.out -> C2.in #blue [ortho]
V5.out -> C3.in #blue [ortho]
V5.out -> C4.in #blue [ortho]
C1.out -> RET.in #slate [ortho]
C2.out -> RET.in #slate [ortho]
C3.out -> RET.in #slate [ortho]
C4.out -> RET.in #slate [ortho]
```

`trunk` is still parsed, validated and recorded as `connection.trunk`, so a 0.8 document keeps compiling. The drawing no longer depends on it, and a net without it is drawn as the same tree. When a branch belongs at one particular place, a `junction` should be put there, and the wires written to it [meet at it](/docs/1.2/nets#junctions). A connection whose joining end carries a marker keeps its full path from terminal to terminal, so an arrowhead never lands on a junction.

<!-- /schemd-section -->
