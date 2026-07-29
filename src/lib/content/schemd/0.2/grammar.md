<!-- schemd-doc: id=grammar; label=Grammar; title=Learn the small Schemd grammar; summary=Place nodes, connect named ports, and choose a route or UML relationship.; category=Author diagrams; order=20 -->

<!-- schemd-section: id=nodes; eyebrow=01 / Nodes; title=Place a component on a bounded canvas; example-title=Bounded analog canvas; example-summary=Four nodes share one stable engineering coordinate system. -->

Every fence opens with a promise about space: `bounds="WIDTHxHEIGHT"`, both integers from 64 to 4096. The compiler reserves that canvas _before_ reading a single declaration, which is why a schemd diagram never reflows the page it lands on.

A node has one predictable shape:

```text
kind:ID "label" at (x, y) color [options]
```

IDs are case-sensitive, coordinates live in the `viewBox` we just declared, and the `[options]` depend entirely on the _kind_ we chose. The colour is a built-in token such as `#blue`, a safe CSS colour, or a theme alias we resolve ourselves.

```schemd bounds="760x320" title="Bounded analog canvas"
port:VIN "Signal" at (60, 160) #blue
resistor:R1 "10 k\Omega" at (250, 160) #amber
capacitor:C1 "100 nF" at (470, 160) #cyan
port:VOUT "Filtered" at (700, 160) #emerald

VIN.out -> R1.in #blue [line]
R1.out -> C1.in #amber [ortho]
C1.out -> VOUT.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=connections; eyebrow=02 / Connections; title=Connect named ports; example-title=Mixed route styles; example-summary=Straight, curved, and obstacle-aware routes can share a canvas. -->

A connection is just as small — two named ports and an arrow:

```text
ID.port -> ID.port color [options]
```

Then choose how the wire travels: `line` for a straight segment, `bezier` for a curve, `ortho` for the obstacle-aware route. An orthogonal connection escapes each component through a short stub, clears every other node's bounds, and — this is the part that matters — fails loudly when no clear path exists rather than drawing a junction that lies about the circuit.

Markers are optional on either end: `marker-start=...` and `marker-end=...` accept `none`, `arrow`, `open-arrow`, `dot`, `triangle`, `diamond`, or `diamond-filled`.

```schemd bounds="780x340" title="Mixed route styles"
port:A "A" at (60, 90) #blue
port:B "B" at (60, 250) #slate
xor:G1 "Parity" at (390, 170) #cyan [inputs=2 outputs=1]
port:Y "Result" at (720, 170) #emerald

A.out -> G1.in1 #blue [bezier]
B.out -> G1.in2 #slate [ortho]
G1.out -> Y.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=uml-relations; eyebrow=03 / UML; title=Use relationship names instead of hand-built markers; example-title=Class relationships; example-summary=Generalization and composition choose their own markers. -->

A UML relationship is nothing more exotic than a connection option: name the relationship and schemd supplies the marker and dash pattern the notation already expects. Disagree with a default and an explicit marker — or a plain `solid`/`dashed` flag — overrides it.

| Relation                | Default style                         |
| ----------------------- | ------------------------------------- |
| `association`           | Solid line                            |
| `dependency`            | Dashed, open arrow                    |
| `generalization`        | Hollow triangle at the target         |
| `realization`           | Dashed, hollow triangle at the target |
| `aggregation`           | Hollow diamond at the source          |
| `composition`           | Filled diamond at the source          |
| `message`, `transition` | Open arrow                            |
| `include`, `extend`     | Dashed, open arrow, automatic label   |

Add `label="text"` whenever the connector needs a name of its own.

```schemd bounds="860x420" title="Class relationships"
class:Account "Account" at (220, 150) #slate [attributes="- id: UUID" operations="+ close(): void"]
class:Admin "Admin" at (620, 120) #blue [operations="+ suspend(): void"]
class:Session "Session" at (620, 310) #emerald [attributes="- token: string"]

Admin.left -> Account.right #blue [ortho generalization]
Account.right -> Session.left #emerald [ortho composition label="owns"]
```

<!-- /schemd-section -->
