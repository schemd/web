<!-- schemd-doc: id=grammar; label=Grammar; title=Use the strict 0.6 grammar; summary=Place typed nodes, rotate canonical geometry, and connect validated semantic ports.; category=Author diagrams; order=20 -->

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
source:VRAIL "V_{rail}" at (390, 90) #blue [type=voltage-dc orientation=down]
transistor:QP "p-channel" at (390, 240) #amber [type=pmos orientation=down]
junction:OUT "OUT" at (390, 350) #cyan
transistor:QNN "n-channel" at (390, 460) #purple [type=nmos orientation=down]
port:SPK "speaker" at (680, 350) #emerald

VRAIL.positive -> QP.drain #blue [line]
QP.source -> OUT.node #amber [line]
OUT.node -> QNN.drain #purple [line]
OUT.node -> SPK.in #emerald [line marker-end=arrow]
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
port:D0 "D0" at (90, 90) #blue [width=1]
port:D1 "D1" at (90, 200) #cyan [width=1]
port:D2 "D2" at (90, 310) #amber [width=1]
port:D3 "D3" at (90, 420) #purple [width=1]
port:Q0 "Q0" at (790, 420) #blue [width=1]
port:Q1 "Q1" at (790, 310) #cyan [width=1]
port:Q2 "Q2" at (790, 200) #amber [width=1]
port:Q3 "Q3" at (790, 90) #purple [width=1]

D0.out -> Q0.in #blue [ortho digital net=LANE0]
D1.out -> Q1.in #cyan [ortho digital net=LANE1]
D2.out -> Q2.in #amber [ortho digital net=LANE2]
D3.out -> Q3.in #purple [ortho digital net=LANE3]
```

Before 0.4 this failed from the third wire on: the router scored reuse of an occupied channel as expensive-but-legal while the validator rejected it outright, so the router could return a route it had already proved would be thrown away. Now a contact the validator rejects costs the router infinity through the same predicate, every trace reserves its terminal approach before any wire is placed, and a blocked channel offers a lane a pitch to either side.

0.5 goes further. When a trace still cannot be placed, the router tears up what it has laid and tries again with that trace first and the rest ordered shortest-span-first, so the tight traces claim their channels while the canvas is empty and the loose ones bend around them. That takes a full reversal bus from ten wires to twelve.

Thirteen is unroutable, and no ordering reaches it — the limit there is the channel model, not the order we declared things in. `compileSchematic` reports what the router had to do in `routing`, down to per-cell congestion, and the [inspector](/inspector/0.6.0) draws it.

<!-- /schemd-section -->

<!-- schemd-section: id=options; eyebrow=03 / Validation; title=Use family options, never untyped attributes; example-title=Named-pin package; example-summary=Each pin name becomes an addressable, case-sensitive port. -->

Options are validated by name against the kind we named. The common ones are `type`, `orientation`, `inputs`, `outputs`, `width`, `controls`, `targets`, `wires`, `parameter`, `phase`, `matrix`, `operator`, and `control`; availability per kind lives in the [component API](/docs/0.6/component-reference). There is no untyped attribute bag, and that is the point — a typo is a compile error, never a silently wrong drawing.

`ic` is the clearest case. Its quoted `left`, `right`, `top`, and `bottom` lists each become case-sensitive ports, and the body grows to fit the longest side, so we never hand-size the box:

```schemd bounds="960x520" title="Named-pin package"
port:MOSI "MOSI" at (80, 190) #blue
port:SCK "SCK" at (80, 290) #amber
ic:U7 "DAC, 16-bit" at (460, 240) #cyan [left="MOSI,SCK,CS" right="VOUTA,VOUTB" top="VDD" bottom="VSS"]
port:VOUT "analog out" at (860, 200) #emerald
ground:VSS "VSS" at (460, 420) #slate

MOSI.out -> U7.MOSI #blue [ortho]
SCK.out -> U7.SCK #amber [ortho]
U7.VOUTA -> VOUT.in #emerald [ortho marker-end=arrow]
U7.VSS -> VSS.in #slate [ortho]
```

Note that we wired `U1.SDA` by its real pin name. `in` and `out` still fall back to the first suitable input and output side when we genuinely do not care which — but on a package with named pins, we usually do.

<!-- /schemd-section -->
