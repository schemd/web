<!-- schemd-doc: id=grammar; label=Grammar; title=Learn the Schemd language; summary=Place typed nodes, address named ports, and choose explicit route and relation semantics.; category=Author diagrams; order=20 -->

<!-- schemd-section: id=nodes; eyebrow=01 / Nodes; title=Place a component on the canvas -->

Every node declaration has one shape:

```text
kind:ID "label" at (x, y) color [options]
```

IDs are case-sensitive. Coordinates use the SVG `viewBox`. The component kind determines the available options and ports. Colors may be a built-in token such as `#blue`, a validated CSS color, or a safe custom-property alias.

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

<!-- schemd-section: id=connections; eyebrow=02 / Connections; title=Connect named ports with an explicit route -->

A connection names its source and target terminals:

```text
ID.port -> ID.port color [options]
```

Choose `line`, `bezier`, or `ortho`. Orthogonal routes leave component bodies through a short escape segment and search around known obstacles. Markers accept `none`, `arrow`, `open-arrow`, `dot`, `triangle`, `diamond`, or `diamond-filled`.

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

<!-- schemd-section: id=uml-relations; eyebrow=03 / UML; title=Name relationships instead of hand-building markers -->

UML relationships are connection options. Schemd derives the conventional marker and dash pattern, while explicit marker and stroke options can override the default.

| Relation                | Default style                    |
| ----------------------- | -------------------------------- |
| `association`           | Solid line                       |
| `dependency`            | Dashed open arrow                |
| `generalization`        | Hollow triangle at target        |
| `realization`           | Dashed hollow triangle at target |
| `aggregation`           | Hollow diamond at source         |
| `composition`           | Filled diamond at source         |
| `message`, `transition` | Open arrow                       |
| `include`, `extend`     | Dashed open arrow with label     |

```schemd bounds="860x420" title="Class relationships"
class:Account "Account" at (220, 150) #slate [attributes="- id: UUID" operations="+ close(): void"]
class:Admin "Admin" at (620, 120) #blue [operations="+ suspend(): void"]
class:Session "Session" at (620, 310) #emerald [attributes="- token: string"]

Admin.left -> Account.right #blue [ortho generalization]
Account.right -> Session.left #emerald [ortho composition label="owns"]
```

<!-- /schemd-section -->

<!-- schemd-section: id=diagnostics; eyebrow=04 / Diagnostics; title=Use source-positioned failures -->

Invalid declarations throw `SchematicSyntaxError`. When a failure maps to a statement, the error exposes a one-based `line` and prefixes the message once.

```ts
try {
	compileSchematic(source, fence);
} catch (error) {
	if (error instanceof SchematicSyntaxError) {
		console.error(error.line, error.message);
	}
}
```

Blocked routes and bounded-limit violations fail instead of hanging or silently drawing through a component.

<!-- /schemd-section -->
