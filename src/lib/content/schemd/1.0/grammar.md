<!-- schemd-doc: id=grammar; label=Grammar; title=Use the strict 1.0 grammar; summary=Place typed nodes, rotate canonical geometry, and connect validated semantic ports.; category=Author diagrams; order=20 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Grammar fragments show one declaration at a time. -->

<!-- schemd-section: id=declarations; eyebrow=01 / Nodes; title=Declare one bounded component per line; example-title=Vertical LED string; example-summary=Orientation rotates geometry; the logical port names stay put. -->

One declaration, one line:

```text
kind:ID "label" at (x, y) #color [options]
```

Identifiers are case-sensitive and become source-map keys. An unknown, duplicated, or kind-incompatible option is a compile error carrying a one-based line number.

`orientation` accepts exactly `right`, `down`, `left`, or `up`, and is rejected outright for a node no rotation can mean — a `junction` has no facing. What rotates is geometry: the body, its ports, their outward normals, the collision rectangle, and the routing corridors, all together. What never rotates is the vocabulary. A vertical diode is still wired `anode` to `cathode`, and a vertical source still has a `positive` and a `negative`, so rotating a symbol never rewrites the connections around it.

```schemd bounds="820x600" title="Vertical LED string"
source:VIN "V_{in}" at (390, 90) #blue [type=voltage-dc orientation=down]
resistor:RL "330 \Omega" at (390, 230) #amber [orientation=down]
junction:MID "V_{f}" at (390, 340) #cyan
diode:DL "status" at (390, 460) #rose [type=led orientation=down]
port:SENSE "to ADC" at (680, 340) #emerald

VIN.positive -> RL.in #blue [ortho]
RL.out -> MID.node #amber [ortho]
MID.node -> DL.anode #rose [ortho]
MID.node -> SENSE.in #emerald [ortho marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=connections; eyebrow=02 / Wires; title=Connect semantic ports and signal domains; example-title=Six-lane reversal bus; example-summary=Every lane must cross every other; each net is routed once, in an order taken from the geometry. -->

A connection is two terminals and an arrow:

```text
A.port -> B.port #color [options]
```

Routes are `line`, `bezier`, or `ortho`. Signal domains are `electrical`, `digital`, `quantum`, and `classical`, and a width mismatch is rejected before layout rather than drawn as a plausible lie.

`net=NAME` gives a group of segments one topology identity. Segments that share an exact `component.port` join implicitly — every branch off one `junction.node` is therefore one net — and a name can additionally join segments that never touch. Every segment in a net must agree on domain and width; conflicting names at a shared terminal are errors. Unnamed topologies still get deterministic, source-ordered `$1`, `$2`, … identities in the AST, the source map, and full-mode SVG (`data-net-id`).

Contact on the page always means contact in the circuit. Separate nets never touch: where two cross, the vertical run carries a bridge. Wires of one net that cross are one node and get a dot. Bodies may touch at an edge but never overlap, and a `line` or `bezier` wire through another part's terminal is rejected because it would read as a connection. The [nets and junctions](/docs/1.0/nets) page covers all of it.

A reversal bus exercises the router hardest — every lane must cross every other:

```schemd bounds="900x620" title="Six-lane reversal bus"
port:I0 "I_0" at (100, 90) #rose [width=1]
port:I1 "I_1" at (100, 180) #blue [width=1]
port:I2 "I_2" at (100, 270) #amber [width=1]
port:I3 "I_3" at (100, 360) #violet [width=1]
port:I4 "I_4" at (100, 450) #emerald [width=1]
port:I5 "I_5" at (100, 540) #cyan [width=1]
port:O0 "O_0" at (800, 540) #rose [width=1]
port:O1 "O_1" at (800, 450) #blue [width=1]
port:O2 "O_2" at (800, 360) #amber [width=1]
port:O3 "O_3" at (800, 270) #violet [width=1]
port:O4 "O_4" at (800, 180) #emerald [width=1]
port:O5 "O_5" at (800, 90) #cyan [width=1]

I0.out -> O0.in #rose [ortho digital net=L0]
I1.out -> O1.in #blue [ortho digital net=L1]
I2.out -> O2.in #amber [ortho digital net=L2]
I3.out -> O3.in #violet [ortho digital net=L3]
I4.out -> O4.in #emerald [ortho digital net=L4]
I5.out -> O5.in #cyan [ortho digital net=L5]
```

1.0 routes this differently in kind from 0.8. Each net is searched once on a lattice of channel-pitch lines plus the coordinates that matter, in an order derived from where its terminals sit — never from declaration order — and contact between nets is forbidden on that pass. A net that still cannot be placed is placed at a price, and the nets in contact are torn up and rerouted with the price raised and a history cost on every location contested before. Every cost is an integer, so the result is the same on every engine.

`compileSchematic` reports what the router had to do in `routing`: `attempts` counts negotiation rounds, `rippedUp` the wires torn up in them, and `congestion` the load on each lattice cell. A contended twelve-wire bus routes in the first pass in about 1.5 ms. The per-connection router, its reorder and rip-up rescue, and 0.7's bundle nudging are gone, so `routing.nudged` is always `false`. The [inspector](/inspector/1.0.2) draws the report.

<!-- /schemd-section -->

<!-- schemd-section: id=options; eyebrow=03 / Validation; title=Use family options, never untyped attributes; example-title=Named-pin charger; example-summary=Each pin name becomes an addressable, case-sensitive port. -->

Options are validated by name against the kind we named. The common ones are `type`, `orientation`, `inputs`, `outputs`, `width`, `controls`, `targets`, `wires`, `parameter`, `phase`, `matrix`, `operator`, and `control`; availability per kind lives in the [component API](/docs/1.0/component-reference). There is no untyped attribute bag, and that is the point — a typo is a compile error, never a silently wrong drawing.

`ic` is the clearest case. Its quoted `left`, `right`, `top`, and `bottom` lists each become case-sensitive ports, and the body grows to fit the longest side, so we never hand-size the box:

```schemd bounds="980x540" title="Named-pin charger"
port:USB "VBUS" at (90, 190) #blue
port:CE "charge enable" at (90, 320) #amber
ic:U5 "CHG" at (470, 260) #cyan [left="IN,CE,ILIM" right="BAT,STAT,TS" bottom="GND"]
source:CELL "Li-ion" at (870, 190) #emerald [type=battery orientation=down]
ground:CGND "0 V" at (470, 450) #slate

USB.out -> U5.IN #blue [ortho]
CE.out -> U5.CE #amber [ortho]
U5.BAT -> CELL.positive #emerald [ortho marker-end=arrow]
U5.GND -> CGND.in #slate [ortho]
```

Note that we wired `U5.IN` by its real pin name. `in` and `out` still fall back to the first suitable input and output side when we genuinely do not care which — but on a package with named pins, we usually do.

<!-- /schemd-section -->

<!-- schemd-section: id=trunks; eyebrow=04 / Trees; title=Every multi-terminal net is a tree; example-title=Sensor returns; example-summary=Four sensors share one supply and one return, each drawn as a tree with no option at all. -->

A net that reaches several terminals is still written as one connection per terminal, and 1.0 draws it as a tree without being asked. The first connection runs terminal to terminal; every later one leaves the nearest copper the net already has, with a dot where it joins. Which branch joins where is decided by geometry, so reordering the lines changes nothing.

```schemd bounds="1000x500" title="Sensor returns"
port:VS "V_{s}" at (90, 120) #blue
resistor:S1 "NTC_1" at (330, 240) #amber [type=thermistor orientation=down]
resistor:S2 "NTC_2" at (510, 240) #amber [type=thermistor orientation=down]
resistor:S3 "LDR" at (690, 240) #amber [type=ldr orientation=down]
resistor:S4 "pot" at (870, 240) #amber [type=potentiometer orientation=down]
ground:RET "0 V" at (150, 420) #slate

VS.out -> S1.in #blue [ortho]
VS.out -> S2.in #blue [ortho]
VS.out -> S3.in #blue [ortho]
VS.out -> S4.in #blue [ortho]
S1.out -> RET.in #slate [ortho]
S2.out -> RET.in #slate [ortho]
S3.out -> RET.in #slate [ortho]
S4.out -> RET.in #slate [ortho]
```

`trunk` is still parsed, validated, and recorded as `connection.trunk`, so a 0.8 document keeps compiling, but the drawing no longer depends on it: a net without it is drawn the same tree. When a branch belongs at a particular place, put a `junction` there; wires written to it [meet at it](/docs/1.0/nets#junctions). A connection whose joining end carries a marker keeps its full terminal-to-terminal path, so an arrowhead never lands on a junction.

<!-- /schemd-section -->
