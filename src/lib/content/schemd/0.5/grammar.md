<!-- schemd-doc: id=grammar; label=Grammar; title=Use the strict 0.5 grammar; summary=Place typed nodes, rotate canonical geometry, and connect validated semantic ports.; category=Author diagrams; order=20 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Grammar fragments show one declaration at a time. -->

<!-- schemd-section: id=declarations; eyebrow=01 / Nodes; title=Declare one bounded component per line; example-title=Half-bridge leg; example-summary=Orientation rotates geometry; the logical port names stay put. -->

One declaration, one line:

```text
kind:ID "label" at (x, y) #color [options]
```

Identifiers are case-sensitive and become source-map keys. An unknown, duplicated, or kind-incompatible option is a compile error carrying a one-based line number.

`orientation` accepts exactly `right`, `down`, `left`, or `up`, and is rejected outright for a node no rotation can mean — a `junction` has no facing. What rotates is geometry: the body, its ports, their outward normals, the collision rectangle, and the routing corridors, all together. What never rotates is the vocabulary. A vertical transistor is still wired through `gate`, `drain`, and `source`, so rotating a symbol never rewrites the connections around it.

```schemd bounds="820x560" title="Half-bridge leg"
source:VBUS "V_{bus}" at (390, 90) #blue [type=voltage-dc orientation=down]
transistor:QH "high side" below VBUS by 30 aligned-x with VBUS #amber [type=nmos orientation=down]
junction:SW "SW" below QH by 20 aligned-x with QH #cyan
transistor:QL "low side" below SW by 20 aligned-x with SW #purple [type=nmos orientation=down]
port:PHASE "phase" right-of SW by 180 #emerald

VBUS.positive -> QH.drain #blue [line]
QH.source -> SW.node #amber [line]
SW.node -> QL.drain #purple [line]
SW.node -> PHASE.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=connections; eyebrow=02 / Wires; title=Connect semantic ports and signal domains; example-title=Four-wire reversal bus; example-summary=Crossing traces reserve their terminals before any wire is placed. -->

A connection is two terminals and an arrow:

```text
A.port -> B.port #color [options]
```

Routes are `line`, `bezier`, or `ortho`. Signal domains are `electrical`, `digital`, `quantum`, and `classical`, and a width mismatch is rejected before layout rather than drawn as a plausible lie.

`net=NAME` gives a group of segments one topology identity. Segments that share an exact `component.port` join implicitly — every branch off one `junction.node` is therefore one net — and a name can additionally join segments that never touch. Every segment in a net must agree on domain and width; conflicting names at a shared terminal are errors. Unnamed topologies still get deterministic, source-ordered `$1`, `$2`, … identities in the AST, the source map, and full-mode SVG (`data-net-id`).

Geometry is contract-checked. Bodies may touch at an edge but never overlap, and every route family is collision-checked against bodies, labels, and earlier wire channels. Two **separate** nets may cross only as a strict perpendicular orthogonal crossing, and the later trace receives a bridge; two segments of the **same** net stay continuous with no bridge, because they are one conductor. Collinear overlap between separate nets, endpoint contact, diagonal crossings, and bridge clusters too dense to render are all compile errors with source lines.

A reversal bus is the case that exercises all of it at once — every wire must cross every other:

```schemd bounds="880x500" title="Four-wire reversal bus"
port:A0 "A0" at (90, 80) #blue [width=1]
port:A1 "A1" below A0 by 40 aligned-x with A0 #cyan [width=1]
port:A2 "A2" below A1 by 40 aligned-x with A1 #amber [width=1]
port:A3 "A3" below A2 by 40 aligned-x with A2 #purple [width=1]
port:B3 "B3" right-of A0 by 600 aligned-y with A0 #purple [width=1]
port:B2 "B2" below B3 by 40 aligned-x with B3 #amber [width=1]
port:B1 "B1" below B2 by 40 aligned-x with B2 #cyan [width=1]
port:B0 "B0" below B1 by 40 aligned-x with B1 #blue [width=1]

A0.out -> B0.in #blue [ortho digital net=BIT0]
A1.out -> B1.in #cyan [ortho digital net=BIT1]
A2.out -> B2.in #amber [ortho digital net=BIT2]
A3.out -> B3.in #purple [ortho digital net=BIT3]
```

Before 0.4 this failed from the third wire on: the router scored reuse of an occupied channel as expensive-but-legal while the validator rejected it outright, so the router could return a route it had already proved would be thrown away. Now a contact the validator rejects costs the router infinity through the same predicate, every trace reserves its terminal approach before any wire is placed, and a blocked channel offers a lane a pitch to either side.

0.5 goes further. When a trace still cannot be placed, the router tears up what it has laid and tries again with that trace first and the rest ordered shortest-span-first, so the tight traces claim their channels while the canvas is empty and the loose ones bend around them. That takes a full reversal bus from ten wires to twelve.

Thirteen is unroutable, and no ordering reaches it — the limit there is the channel model, not the order we declared things in. `compileSchematic` reports what the router had to do in `routing`, down to per-cell congestion, and the [inspector](/inspector/0.5.0) draws it.

<!-- /schemd-section -->

<!-- schemd-section: id=options; eyebrow=03 / Validation; title=Use family options, never untyped attributes; example-title=Named-pin package; example-summary=Each pin name becomes an addressable, case-sensitive port. -->

Options are validated by name against the kind we named. The common ones are `type`, `orientation`, `inputs`, `outputs`, `width`, `controls`, `targets`, `wires`, `parameter`, `phase`, `matrix`, `operator`, and `control`; availability per kind lives in the [component API](/docs/0.5/component-reference). There is no untyped attribute bag, and that is the point — a typo is a compile error, never a silently wrong drawing.

`ic` is the clearest case. Its quoted `left`, `right`, `top`, and `bottom` lists each become case-sensitive ports, and the body grows to fit the longest side, so we never hand-size the box:

```schemd bounds="960x520" title="Named-pin package"
port:SDA "SDA" at (80, 140) #blue
port:SCL "SCL" below SDA by 40 aligned-x with SDA #amber
ic:U1 "ADC, 24-bit" right-of SDA by 220 aligned-y with SCL #cyan [left="SDA,SCL,DRDY" right="AIN0,AIN1" top="AVDD" bottom="AGND"]
port:AIN "sensor" right-of U1 by 200 aligned-y with SDA #emerald
ground:GND "AGND" below U1 by 20 aligned-x with U1 #slate

SDA.out -> U1.SDA #blue [ortho]
SCL.out -> U1.SCL #amber [ortho]
U1.AIN0 -> AIN.in #emerald [ortho marker-end=arrow]
```

Note that we wired `U1.SDA` by its real pin name. `in` and `out` still fall back to the first suitable input and output side when we genuinely do not care which — but on a package with named pins, we usually do.

<!-- /schemd-section -->
