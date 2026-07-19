<!-- schemd-doc: id=grammar; label=Grammar; title=Learn the small Schemd grammar; summary=Place nodes, connect named ports, and choose a route or UML relationship.; category=Author diagrams; order=20 -->

<!-- schemd-section: id=nodes; eyebrow=01 / Nodes; title=Place a component on a bounded canvas; example-title=Bounded analog canvas; example-summary=Four nodes share one stable engineering coordinate system. -->

Every fence needs `bounds="WIDTHxHEIGHT"`. Both dimensions must be integers from 64 to 4096.

A node has one predictable shape:

```text
kind:ID "label" at (x, y) color [options]
```

IDs are case-sensitive. Coordinates use the SVG `viewBox`, and options depend on the node kind. The color can be a built-in token such as `#blue`, a safe CSS color, or a theme alias.

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

A connection is just as small:

```text
ID.port -> ID.port color [options]
```

Choose `line`, `bezier`, or `ortho`. Orthogonal routes leave component bodies through a short escape segment, avoid other node bounds, and fail with a useful error if no clear route exists.

Markers are optional: `marker-start=...` and `marker-end=...` accept `none`, `arrow`, `open-arrow`, `dot`, `triangle`, `diamond`, or `diamond-filled`.

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

UML relationships are connection options. Schemd supplies the usual marker and dash pattern, while an explicit marker or `solid`/`dashed` option can override the default.

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

Add `label="text"` when the connector needs a name.

```schemd bounds="860x420" title="Class relationships"
class:Account "Account" at (220, 150) #slate [attributes="- id: UUID" operations="+ close(): void"]
class:Admin "Admin" at (620, 120) #blue [operations="+ suspend(): void"]
class:Session "Session" at (620, 310) #emerald [attributes="- token: string"]

Admin.left -> Account.right #blue [ortho generalization]
Account.right -> Session.left #emerald [ortho composition label="owns"]
```

<!-- /schemd-section -->
