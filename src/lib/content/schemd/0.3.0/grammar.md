<!-- schemd-doc: id=grammar; label=Grammar; title=Use the strict 0.3 grammar; summary=Place typed nodes, rotate canonical geometry, and connect validated semantic ports.; category=Author diagrams; order=20 -->

<!-- schemd-section: id=declarations; eyebrow=01 / Nodes; title=Declare one bounded component per line; example-title=Four exact orientations -->

The declaration grammar is `kind:ID "label" at (x, y) #color [options]`. Identifiers are stable source-map keys. Unknown, duplicated, or kind-incompatible options fail with a one-based line diagnostic.

`orientation` accepts only `right`, `down`, `left`, or `up`. It is rejected for rotationally meaningless nodes such as `junction`. Logical port names never rotate.

```schemd bounds="860x360" title="Four exact orientations"
resistor:R0 "right" at (130, 150) #amber [orientation=right]
resistor:R1 "down" at (330, 150) #cyan [orientation=down]
resistor:R2 "left" at (530, 150) #purple [orientation=left]
resistor:R3 "up" at (730, 150) #emerald [orientation=up]
```

<!-- /schemd-section -->

<!-- schemd-section: id=connections; eyebrow=02 / Wires; title=Connect semantic ports and signal domains; example-title=Typed digital bus -->

Connections use `A.port -> B.port #color [options]`. Routes are `line`, `bezier`, or `ortho`. Signal domains are `electrical`, `digital`, `quantum`, and `classical`; width mismatches are rejected before layout.

```schemd bounds="820x330" title="Typed digital bus"
port:INPUT "D[7:0]" at (80, 140) #blue [width=8]
register:REG "R0" at (330, 140) #cyan [width=8]
port:OUTPUT "Q[7:0]" at (650, 140) #emerald [width=8]
INPUT.out -> REG.in #blue [digital width=8]
REG.out -> OUTPUT.in #emerald [digital width=8]
```

Connection options also include `marker-start`, `marker-end`, `label`, UML relations, and `dashed`. Full mode emits source-line metadata for nodes, ports, and wires.

<!-- /schemd-section -->

<!-- schemd-section: id=options; eyebrow=03 / Validation; title=Use family options, never untyped attributes; example-title=Variant-driven components -->

Common family options are `type`, `orientation`, `inputs`, `outputs`, `width`, `controls`, `targets`, `wires`, `parameter`, `phase`, `matrix`, `operator`, and `control`. Availability is defined per kind in the [component API](/docs/0.3.0/component-reference).

```schemd bounds="900x360" title="Variant-driven components"
source:AC "AC" at (100, 150) #blue [type=voltage-ac orientation=down]
buffer:BUF "3-state" at (340, 150) #cyan [type=tristate orientation=left]
controlled:CU "U" at (580, 150) #purple [controls=2 targets=1 operator="R_z"]
component:CPU "controller" at (790, 150) #slate [width=150 height=90]
```

<!-- /schemd-section -->
