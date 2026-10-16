<!-- schemd-doc: id=grammar; label=Grammar; title=Use the strict 0.8 grammar; summary=Place typed nodes, rotate canonical geometry, and connect validated semantic ports.; category=Author diagrams; order=20 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Grammar fragments show one declaration at a time. -->

<!-- schemd-section: id=declarations; eyebrow=01 / Nodes; title=Declare one bounded component per line; example-title=Synchronous buck leg; example-summary=Orientation rotates geometry; the logical port names stay put. -->

One declaration, one line:

```text
kind:ID "label" at (x, y) #color [options]
```

Identifiers are case-sensitive and become source-map keys. An unknown, duplicated, or kind-incompatible option is a compile error carrying a one-based line number.

`orientation` accepts exactly `right`, `down`, `left`, or `up`, and is rejected outright for a node no rotation can mean — a `junction` has no facing. What rotates is geometry: the body, its ports, their outward normals, the collision rectangle, and the routing corridors, all together. What never rotates is the vocabulary. A vertical transistor is still wired through `gate`, `drain`, and `source`, so rotating a symbol never rewrites the connections around it.

```schemd bounds="820x560" title="Synchronous buck leg"
source:VIN "V_{in}" at (390, 90) #blue [type=voltage-dc orientation=down]
transistor:QT "top FET" at (390, 240) #amber [type=nmos orientation=down]
junction:PH "PH" at (390, 350) #cyan
transistor:QB "bottom FET" at (390, 460) #purple [type=nmos orientation=down]
port:IND "to inductor" at (680, 350) #emerald

VIN.positive -> QT.drain #blue [line]
QT.source -> PH.node #amber [line]
PH.node -> QB.drain #purple [line]
PH.node -> IND.in #emerald [line marker-end=arrow]
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

```schemd bounds="900x540" title="Five-wire reversal bus"
port:A0 "A0" at (100, 90) #rose [width=1]
port:A1 "A1" at (100, 182) #blue [width=1]
port:A2 "A2" at (100, 274) #amber [width=1]
port:A3 "A3" at (100, 366) #violet [width=1]
port:A4 "A4" at (100, 458) #emerald [width=1]
port:Z0 "Z0" at (800, 458) #rose [width=1]
port:Z1 "Z1" at (800, 366) #blue [width=1]
port:Z2 "Z2" at (800, 274) #amber [width=1]
port:Z3 "Z3" at (800, 182) #violet [width=1]
port:Z4 "Z4" at (800, 90) #emerald [width=1]

A0.out -> Z0.in #rose [ortho digital net=LANE0]
A1.out -> Z1.in #blue [ortho digital net=LANE1]
A2.out -> Z2.in #amber [ortho digital net=LANE2]
A3.out -> Z3.in #violet [ortho digital net=LANE3]
A4.out -> Z4.in #emerald [ortho digital net=LANE4]
```

Before 0.4 this failed from the third wire on: the router scored reuse of an occupied channel as expensive-but-legal while the validator rejected it outright, so the router could return a route it had already proved would be thrown away. Now a contact the validator rejects costs the router infinity through the same predicate, every trace reserves its terminal approach before any wire is placed, and a blocked channel offers a lane a pitch to either side.

0.5 goes further. When a trace still cannot be placed, the router tears up what it has laid and tries again with that trace first and the rest ordered shortest-span-first, so the tight traces claim their channels while the canvas is empty and the loose ones bend around them. That takes a full reversal bus from ten wires to twelve.

0.7 goes further again, and by doing something different in kind. Retrying decides _which trace chooses first_, and in a greedy pass somebody always chooses first — so when the retry budget is spent, the traces are no longer reordered again. The bundle is laid out **as a set**: every trace takes the same five-segment dogleg and they differ only in where each one turns, with rank deciding an outbound column stepping inward from the source, an inbound column stepping inward from the target, and a row through the middle band. Assigning the whole bundle at once is the thing reordering structurally cannot do, and it carries a full reversal bus to **thirty-two wires**.

We should read that as a rescue rather than a replacement. It runs only after retrying has failed, it requires a bundle that is entirely orthogonal, and it verifies every trace against the same obstacle and contact predicates the greedy router uses — if any check fails the bundle is abandoned and the original diagnostic stands. A document that compiled before 0.7 reaches the same routes through the same code.

**A correction worth stating plainly**, because 0.5's documentation made the opposite claim here: thirteen wires was recorded as a limit of the channel model rather than of declaration order, on the evidence that twenty thousand declaration orders failed to route one. The measurement was sound and the conclusion was not — the search was evidence about _ordering_, not about the model. The same fence at the same twelve-unit pitch holds thirty-two.

`compileSchematic` reports what the router had to do in `routing`, down to per-cell congestion, and `routing.nudged` says whether a document needed the bundle path at all — false for everything that routed greedily, which is every document that compiled before 0.7. The [inspector](/inspector/0.8.0) draws it. 0.8 changes none of these routes; it makes the sparse search behind them about one and a half times faster by pricing each grid edge once per route instead of once per visit.

<!-- /schemd-section -->

<!-- schemd-section: id=options; eyebrow=03 / Validation; title=Use family options, never untyped attributes; example-title=Named-pin regulator; example-summary=Each pin name becomes an addressable, case-sensitive port. -->

Options are validated by name against the kind we named. The common ones are `type`, `orientation`, `inputs`, `outputs`, `width`, `controls`, `targets`, `wires`, `parameter`, `phase`, `matrix`, `operator`, and `control`; availability per kind lives in the [component API](/docs/0.8/component-reference). There is no untyped attribute bag, and that is the point — a typo is a compile error, never a silently wrong drawing.

`ic` is the clearest case. Its quoted `left`, `right`, `top`, and `bottom` lists each become case-sensitive ports, and the body grows to fit the longest side, so we never hand-size the box:

```schemd bounds="960x520" title="Named-pin regulator"
source:BAT "V_{bat}" at (90, 200) #blue [type=battery]
port:EN "enable" at (90, 320) #amber
ic:U3 "BUCK" at (460, 250) #cyan [left="VIN,EN,SYNC" right="SW,FB,PG" top="BOOT" bottom="GND"]
port:RAIL "3V3 rail" at (860, 200) #emerald
ground:PGND "PGND" at (460, 430) #slate

BAT.positive -> U3.VIN #blue [ortho]
EN.out -> U3.EN #amber [ortho]
U3.SW -> RAIL.in #emerald [ortho marker-end=arrow]
U3.GND -> PGND.in #slate [ortho]
```

Note that we wired `U3.VIN` by its real pin name. `in` and `out` still fall back to the first suitable input and output side when we genuinely do not care which — but on a package with named pins, we usually do.

<!-- /schemd-section -->

<!-- schemd-section: id=trunks; eyebrow=04 / Trees; title=Draw a multi-terminal net as a tree; example-title=Bypass returns; example-summary=A rail fanning out to four capacitors and their returns fanning in to one ground, each drawn as a tree. -->

A net that reaches several terminals is still written as one connection per terminal. Without help, each of those wires runs back to the shared pin on its own — stacked on one another where the router reuses a channel, and meeting at T-junctions with no dot, which a reader cannot tell from a crossing.

`trunk` fixes the drawing without touching the circuit:

```text
RAIL.out -> CB.in #blue [ortho trunk]
```

A connection marked `trunk` leaves the nearest copper its net already has instead of its own terminal, and a junction dot marks where it joins. Every point on a net is the same electrical node, so the netlist, the design rules, the description and the source map are identical with or without it — only the picture changes.

Which end joins the net is decided by the declarations **above** the branch, never by routing. A branch needs exactly one terminal that an earlier connection already wired: that end becomes the tap, and the other is the terminal the branch reaches out to. In the example, `RAIL.out -> CB.in [trunk]` fans out from the rail's copper, and `CB.out -> GND.in [trunk]` fans in to the return's. The compiler refuses, with the line, a branch whose terminals are both new or both already wired, a `trunk` on a `line`, `bezier` or UML connector, and a marker on the end that joins the net — there is no terminal there for it to sit on.

```schemd bounds="1000x480" title="Bypass returns"
port:RAIL "V_{dd}" at (90, 110) #blue
capacitor:CA "10 \mu F" at (330, 220) #cyan [orientation=down]
capacitor:CB "1 \mu F" at (510, 220) #cyan [orientation=down]
capacitor:CC "100 nF" at (690, 220) #cyan [orientation=down]
capacitor:CD "10 nF" at (870, 220) #cyan [orientation=down]
ground:GND "0 V" at (150, 400) #slate

RAIL.out -> CA.in #blue [ortho]
RAIL.out -> CB.in #blue [ortho trunk]
RAIL.out -> CC.in #blue [ortho trunk]
RAIL.out -> CD.in #blue [ortho trunk]
CA.out -> GND.in #slate [ortho]
CB.out -> GND.in #slate [ortho trunk]
CC.out -> GND.in #slate [ortho trunk]
CD.out -> GND.in #slate [ortho trunk]
```

The tree is a good one rather than the best one. Each branch taps the closest point of the copper laid so far, held two channel pitches off any terminal so its dot cannot crowd the terminal's, and prefers a clean L off the trunk to a dogleg. That is the sequential approximation to a rectilinear Steiner tree, so declaration order still matters: the first wire is the spine the others hang from.

<!-- /schemd-section -->
