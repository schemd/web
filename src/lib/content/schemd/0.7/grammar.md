<!-- schemd-doc: id=grammar; label=Grammar; title=Use the strict 0.7 grammar; summary=Place typed nodes, rotate canonical geometry, and connect validated semantic ports.; category=Author diagrams; order=20 -->

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
transistor:MH "high side" at (390, 240) #amber [type=pmos orientation=down]
junction:SW "SW" at (390, 350) #cyan
transistor:ML "low side" at (390, 460) #purple [type=nmos orientation=down]
port:COIL "coil" at (680, 350) #emerald

VBUS.positive -> MH.drain #blue [line]
MH.source -> SW.node #amber [line]
SW.node -> ML.drain #purple [line]
SW.node -> COIL.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=connections; eyebrow=02 / Wires; title=Connect semantic ports and signal domains; example-title=Five-wire reversal bus; example-summary=Crossing traces reserve their terminals before any wire is placed. -->

A connection is two terminals and an arrow:

```text
A.port -> B.port #color [options]
```

Routes are `line`, `bezier`, or `ortho`. Signal domains are `electrical`, `digital`, `quantum`, and `classical`, and a width mismatch is rejected before layout rather than drawn as a plausible lie.

`net=NAME` gives a group of segments one topology identity. Segments that share an exact `component.port` join implicitly — every branch off one `junction.node` is therefore one net — and a name can additionally join segments that never touch. Every segment in a net must agree on domain and width; conflicting names at a shared terminal are errors. Unnamed topologies still get deterministic, source-ordered `$1`, `$2`, … identities in the AST, the source map, and full-mode SVG (`data-net-id`).

Geometry is contract-checked. Bodies may touch at an edge but never overlap, and every route family is collision-checked against bodies, labels, and earlier wire channels. Two **separate** nets may cross only as a strict perpendicular orthogonal crossing, and the later trace receives a bridge; two segments of the **same** net stay continuous with no bridge, because they are one conductor. Collinear overlap between separate nets, endpoint contact, diagonal crossings, and bridge clusters too dense to render are all compile errors with source lines.

A reversal bus is the case that exercises all of it at once — every wire must cross every other:

```schemd bounds="880x500" title="Five-wire reversal bus"
port:B0 "B0" at (90, 80) #blue [width=1]
port:B1 "B1" at (90, 168) #cyan [width=1]
port:B2 "B2" at (90, 256) #amber [width=1]
port:B3 "B3" at (90, 344) #purple [width=1]
port:B4 "B4" at (90, 432) #emerald [width=1]
port:Y0 "Y0" at (790, 432) #blue [width=1]
port:Y1 "Y1" at (790, 344) #cyan [width=1]
port:Y2 "Y2" at (790, 256) #amber [width=1]
port:Y3 "Y3" at (790, 168) #purple [width=1]
port:Y4 "Y4" at (790, 80) #emerald [width=1]

B0.out -> Y0.in #blue [ortho digital net=LN0]
B1.out -> Y1.in #cyan [ortho digital net=LN1]
B2.out -> Y2.in #amber [ortho digital net=LN2]
B3.out -> Y3.in #purple [ortho digital net=LN3]
B4.out -> Y4.in #emerald [ortho digital net=LN4]
```

Before 0.4 this failed from the third wire on: the router scored reuse of an occupied channel as expensive-but-legal while the validator rejected it outright, so the router could return a route it had already proved would be thrown away. Now a contact the validator rejects costs the router infinity through the same predicate, every trace reserves its terminal approach before any wire is placed, and a blocked channel offers a lane a pitch to either side.

0.5 goes further. When a trace still cannot be placed, the router tears up what it has laid and tries again with that trace first and the rest ordered shortest-span-first, so the tight traces claim their channels while the canvas is empty and the loose ones bend around them. That takes a full reversal bus from ten wires to twelve.

0.7 goes further again, and by doing something different in kind. Retrying decides _which trace chooses first_, and in a greedy pass somebody always chooses first — so when the retry budget is spent, the traces are no longer reordered again. The bundle is laid out **as a set**: every trace takes the same five-segment dogleg and they differ only in where each one turns, with rank deciding an outbound column stepping inward from the source, an inbound column stepping inward from the target, and a row through the middle band. Assigning the whole bundle at once is the thing reordering structurally cannot do, and it carries a full reversal bus to **thirty-two wires**.

We should read that as a rescue rather than a replacement. It runs only after retrying has failed, it requires a bundle that is entirely orthogonal, and it verifies every trace against the same obstacle and contact predicates the greedy router uses — if any check fails the bundle is abandoned and the original diagnostic stands. A document that compiled before 0.7 reaches the same routes through the same code.

**A correction worth stating plainly**, because 0.5's documentation made the opposite claim here: thirteen wires was recorded as a limit of the channel model rather than of declaration order, on the evidence that twenty thousand declaration orders failed to route one. The measurement was sound and the conclusion was not — the search was evidence about _ordering_, not about the model. The same fence at the same twelve-unit pitch holds thirty-two.

`compileSchematic` reports what the router had to do in `routing`, down to per-cell congestion, and `routing.nudged` says whether a document needed the bundle path at all — false for everything that routed greedily, which is every document that compiled before this release. The [inspector](/inspector/0.7.0) draws it.

<!-- /schemd-section -->

<!-- schemd-section: id=options; eyebrow=03 / Validation; title=Use family options, never untyped attributes; example-title=Named-pin package; example-summary=Each pin name becomes an addressable, case-sensitive port. -->

Options are validated by name against the kind we named. The common ones are `type`, `orientation`, `inputs`, `outputs`, `width`, `controls`, `targets`, `wires`, `parameter`, `phase`, `matrix`, `operator`, and `control`; availability per kind lives in the [component API](/docs/0.7/component-reference). There is no untyped attribute bag, and that is the point — a typo is a compile error, never a silently wrong drawing.

`ic` is the clearest case. Its quoted `left`, `right`, `top`, and `bottom` lists each become case-sensitive ports, and the body grows to fit the longest side, so we never hand-size the box:

```schemd bounds="960x520" title="Named-pin package"
port:SDA "SDA" at (80, 190) #blue
port:SCL "SCL" at (80, 290) #amber
ic:U8 "ADC, 12-bit" at (460, 240) #cyan [left="SDA,SCL,ALERT" right="AIN0,AIN1" top="AVDD" bottom="AGND"]
port:AIN "analog in" at (860, 200) #emerald
ground:AGD "AGND" at (460, 420) #slate

SDA.out -> U8.SDA #blue [ortho]
SCL.out -> U8.SCL #amber [ortho]
U8.AIN0 -> AIN.in #emerald [ortho marker-end=arrow]
U8.AGND -> AGD.in #slate [ortho]
```

Note that we wired `U1.SDA` by its real pin name. `in` and `out` still fall back to the first suitable input and output side when we genuinely do not care which — but on a package with named pins, we usually do.

<!-- /schemd-section -->
