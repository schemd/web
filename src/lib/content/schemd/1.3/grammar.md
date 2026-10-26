<!-- schemd-doc: id=grammar; label=Grammar; title=Use the strict 1.3 grammar; summary=Place typed nodes, rotate canonical geometry, and connect validated semantic ports.; category=Author diagrams; order=20 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Grammar fragments show one declaration at a time. -->

<!-- schemd-section: id=declarations; eyebrow=01 / Nodes; title=Declare one bounded component per line; example-title=Vertical Zener reference; example-summary=Orientation rotates the geometry, and the port names stay where they were. -->

Each component is declared on one line:

```text
kind:ID "label" at (x, y) #color [options]
```

Identifiers are case-sensitive, and each one becomes a key in the source map. An option that is unknown, repeated or foreign to the kind is a compile error with a one-based line number.

Since 1.2 the quoted label may be left out. `junction:JZ at (380, 360) #cyan` is a complete declaration, and the part draws its designator alone. An empty pair of quotes is still an error, because a label that says nothing should simply not be written.

`orientation` accepts exactly `right`, `down`, `left` or `up`. A part that no rotation can change, such as a `junction`, rejects it outright. Rotation moves the geometry as one piece: the body, its ports, their outward normals, the collision rectangle and the routing corridors. The vocabulary never rotates. A vertical diode is still wired from `anode` to `cathode`, and a vertical source still has a `positive` and a `negative`. Hence rotating a symbol never rewrites the connections around it.

```schemd bounds="800x720" title="Vertical Zener reference"
source:VS "9 V" at (380, 90) #blue [type=voltage-dc orientation=down]
resistor:RZ "1 k\Omega" at (380, 240) #amber [orientation=down]
junction:JZ at (380, 360) #cyan
diode:DZ "5.1 V" at (380, 490) #rose [type=zener orientation=up]
port:REF "V_{ref}" at (660, 360) #emerald
ground:GZ at (380, 640) #slate

VS.positive -> RZ.in #blue [ortho]
RZ.out -> JZ.node #amber [ortho]
JZ.node -> DZ.cathode #rose [ortho]
JZ.node -> REF.in #emerald [ortho marker-end=arrow]
DZ.anode -> GZ.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=connections; eyebrow=02 / Wires; title=Connect semantic ports and signal domains; example-title=Four-lane reversal bus; example-summary=Every lane must cross every other; each net is routed once, in an order taken from the geometry. -->

A connection is two terminals joined by an arrow:

```text
A.port -> B.port #color [options]
```

A route is `line`, `bezier` or `ortho`. The signal domains are `electrical`, `digital`, `quantum` and `classical`. A width mismatch is rejected before layout, so it is never drawn as a plausible mistake.

`net=NAME` gives a group of segments one identity. Segments that share an exact `component.port` join without being told, so every branch off one `junction.node` is one net. A name can also join segments that never touch. All the segments of a net must agree on domain and width, and two different names at a shared terminal are an error. A net without a name still gets a stable identity, `$1`, `$2` and so on in source order, and it appears in the AST, the source map and the `data-net-id` of `full`-mode SVG.

Contact on the page always means contact in the circuit. Separate nets never touch: where two of them cross, the vertical run carries a bridge. Wires of one net that cross are one node and get a dot. Bodies may meet at an edge but never overlap. A `line` or `bezier` wire through another part's terminal is rejected, since it would read as a connection. The [nets and junctions](/docs/1.3/nets) page covers each rule.

A reversal bus is the hardest test for the router, because every lane has to cross every other:

```schemd bounds="880x570" title="Four-lane reversal bus"
port:W0 "W_0" at (100, 110) #rose [width=1]
port:W1 "W_1" at (100, 230) #blue [width=1]
port:W2 "W_2" at (100, 350) #amber [width=1]
port:W3 "W_3" at (100, 470) #emerald [width=1]
port:Z0 "Z_0" at (780, 470) #rose [width=1]
port:Z1 "Z_1" at (780, 350) #blue [width=1]
port:Z2 "Z_2" at (780, 230) #amber [width=1]
port:Z3 "Z_3" at (780, 110) #emerald [width=1]

W0.out -> Z0.in #rose [ortho digital net=R0]
W1.out -> Z1.in #blue [ortho digital net=R1]
W2.out -> Z2.in #amber [ortho digital net=R2]
W3.out -> Z3.in #emerald [ortho digital net=R3]
```

Each net is searched once on a lattice of channel-pitch lines and the coordinates that matter. The order of the search comes from where the terminals sit and never from the order of declaration, and contact between nets is forbidden on that pass. A net that still cannot be placed is placed at a price. The nets it touches are then torn up and routed again, with the price raised and a history cost added to every location contested before. Every cost is an integer, so the result is the same on every JavaScript engine.

`compileSchematic` reports the router's work in `routing`. `attempts` counts the negotiation rounds, `rippedUp` counts the wires torn up in them, and `congestion` gives the load on each lattice cell. A contended twelve-wire bus routes in the first pass in about 1.5 ms. `routing.nudged` is always `false`, because the bundle nudging of 0.7 no longer exists. The [inspector](/inspector/1.3.0) draws the whole report.

<!-- /schemd-section -->

<!-- schemd-section: id=options; eyebrow=03 / Validation; title=Use family options, never untyped attributes; example-title=Named-pin motor driver; example-summary=Each pin name becomes an addressable, case-sensitive port. -->

Options are checked by name against the kind they belong to. The common ones are `type`, `orientation`, `inputs`, `outputs`, `width`, `controls`, `targets`, `wires`, `parameter`, `phase`, `matrix`, `operator`, `control` and [`fit`](/docs/1.3/fit). Which kind accepts which option is listed in the [component API](/docs/1.3/component-reference). There is no untyped attribute bag. A misspelt option is therefore a compile error and never a drawing that is quietly wrong.

`ic` shows this best. Its quoted `left`, `right`, `top` and `bottom` lists each become case-sensitive ports, and the body grows to fit its longest side, so the box is never sized by hand:

```schemd bounds="960x540" title="Named-pin motor driver"
port:PWM1 "PWM_A" at (90, 130) #blue
port:PWM2 "PWM_B" at (90, 250) #blue
port:NSLP "awake" at (90, 370) #amber
ic:U5 "DRV" at (450, 250) #cyan [left="IN1,IN2,nSLEEP" right="OUT1,OUT2" bottom="GND"]
load:MOT "motor" at (790, 250) #emerald [type=motor orientation=down]
ground:DG "0 V" at (450, 460) #slate

PWM1.out -> U5.IN1 #blue [ortho]
PWM2.out -> U5.IN2 #blue [ortho]
NSLP.out -> U5.nSLEEP #amber [ortho]
U5.OUT1 -> MOT.in #emerald [ortho]
U5.OUT2 -> MOT.out #emerald [ortho]
U5.GND -> DG.in #slate [ortho]
```

Every wire here names a real pin, from `U5.IN1` to `U5.GND`. The generic `in` and `out` still resolve to the first suitable input and output when the choice does not matter. On a package with named pins it usually does.

<!-- /schemd-section -->

<!-- schemd-section: id=trunks; eyebrow=04 / Trees; title=Every multi-terminal net is a tree; example-title=Lamps on one rail; example-summary=Three lamps and a buzzer share one supply and one return, each net drawn as a tree with no option at all. -->

A net that reaches several terminals is still written as one connection per terminal, and it is drawn as a tree without being asked. The first connection runs from terminal to terminal. Each later one leaves the nearest copper the net already has, with a dot where it joins. Geometry decides which branch joins where, so reordering the lines changes nothing.

```schemd bounds="940x520" title="Lamps on one rail"
port:V24 "24 V" at (90, 110) #blue
load:L1 "run" at (300, 260) #emerald [type=lamp orientation=down]
load:L2 "stop" at (470, 260) #emerald [type=lamp orientation=down]
load:L3 "fault" at (640, 260) #emerald [type=lamp orientation=down]
load:B4 "alarm" at (810, 260) #emerald [type=buzzer orientation=down]
ground:COM "0 V" at (120, 440) #slate

V24.out -> L1.in #blue [ortho]
V24.out -> L2.in #blue [ortho]
V24.out -> L3.in #blue [ortho]
V24.out -> B4.in #blue [ortho]
L1.out -> COM.in #slate [ortho]
L2.out -> COM.in #slate [ortho]
L3.out -> COM.in #slate [ortho]
B4.out -> COM.in #slate [ortho]
```

`trunk` is still parsed, validated and recorded as `connection.trunk`, so a 0.8 document keeps compiling. The drawing no longer depends on it, and a net without it is drawn as the same tree. When a branch belongs at one particular place, a `junction` should be put there, and the wires written to it [meet at it](/docs/1.3/nets#junctions). A connection whose joining end carries a marker keeps its full path from terminal to terminal, so an arrowhead never lands on a junction.

<!-- /schemd-section -->
