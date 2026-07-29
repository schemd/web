<!-- schemd-doc: id=grammar; label=Grammar; title=Use the strict 0.3 grammar; summary=Place typed nodes, rotate canonical geometry, and connect validated semantic ports.; category=Author diagrams; order=20 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Grammar fragments show one declaration at a time. -->

<!-- schemd-section: id=declarations; eyebrow=01 / Nodes; title=Declare one bounded component per line; example-title=Four exact orientations -->

One declaration, one line:

```text
kind:ID "label" at (x, y) #color [options]
```

Identifiers are case-sensitive and become stable source-map keys. An unknown, duplicated, or kind-incompatible option fails with a one-based line diagnostic.

`orientation` takes exactly `right`, `down`, `left`, or `up`, and is rejected for a node no rotation can mean — a `junction` has no facing. Note that the option turns geometry, never vocabulary: the shunt resistor below is vertical, and it is still wired `in` to `out`.

```schemd bounds="900x400" title="Rotated passives in place"
resistor:RS "shunt" at (150, 200) #amber [orientation=up]
capacitor:CS "bypass" at (330, 200) #cyan [orientation=down]
inductor:LS "choke" at (510, 200) #purple [orientation=left]
diode:DS "return" at (690, 200) #emerald [orientation=up]
```

<!-- /schemd-section -->

<!-- schemd-section: id=connections; eyebrow=02 / Wires; title=Connect semantic ports and signal domains; example-title=Typed digital bus -->

A connection is two terminals and an arrow:

```text
A.port -> B.port #color [options]
```

Routes are `line`, `bezier`, or `ortho`. Signal domains are `electrical`, `digital`, `quantum`, and `classical`, and a width mismatch is rejected before layout rather than drawn as a plausible lie — a 4-bit bus cannot quietly land on a 1-bit port.

```schemd bounds="900x460" title="Clocked datapath"
clock:REF "f_{ref}" at (90, 150) #amber
port:DIN "D[3:0]" at (90, 320) #blue [width=4]
flipflop:FF "D" at (360, 150) #cyan [type=d]
register:PIPE "pipe" at (360, 320) #purple [width=4]
port:Q "Q" at (700, 150) #emerald
port:DOUT "Q[3:0]" at (700, 320) #emerald [width=4]

REF.out -> FF.clock #amber [digital line]
DIN.out -> PIPE.in #blue [digital line width=4]
FF.q -> Q.in #cyan [digital line]
PIPE.out -> DOUT.in #purple [digital line width=4]
```

Connection options also include `net`, `marker-start`, `marker-end`, `label`, UML relations, and `dashed`. Full mode emits source-line metadata for nodes, ports, and wires.

`net=NAME` gives signal segments one explicit topology identity. Names begin with an ASCII letter, contain only letters, digits, `_`, or `-`, and are at most 64 characters. Segments sharing an exact `component.port` join implicitly, so every branch declared through the same `junction.node` inherits one net, and a name may also join geometrically disconnected segments. Every segment in one net must use the same signal domain and width; conflicting names at a shared terminal are errors. UML relations cannot declare nets. Unnamed signal topologies receive deterministic source-ordered `$1`, `$2`, … identities in the AST, source map, and full-mode SVG (`data-net-id`).

Geometry is contract-checked at compile time. Physical component bodies may touch at an edge but cannot overlap (UML containers and lifeline overlays may intentionally contain children). All route families are collision checked: straight and cubic paths cannot penetrate unrelated bodies or earlier connector labels, orthogonal paths route around bodies and labels while pricing earlier unrelated wire channels as soft occupancy, and transformed endpoint-marker footprints participate in the same rule. Separate nets may cross only as a strict perpendicular orthogonal crossing — which receives a bridge on the later trace — while same-net contacts stay continuous with no bridge. Collinear overlap between separate nets, endpoint contact, diagonal or cubic crossings, and bridge clusters too dense to render are compile errors with source-line diagnostics.

<!-- /schemd-section -->

<!-- schemd-section: id=options; eyebrow=03 / Validation; title=Use family options, never untyped attributes; example-title=Variant-driven components -->

Options are validated by name against the kind we named: `type`, `orientation`, `inputs`, `outputs`, `width`, `controls`, `targets`, `wires`, `parameter`, `phase`, `matrix`, `operator`, and `control`, with availability defined per kind in the [component API](/docs/0.3/component-reference). There is no untyped attribute bag, so a misspelled option is a compile error rather than a silently wrong drawing.

```schemd bounds="960x380" title="One option, four families"
source:PULSE "pulse" at (110, 170) #blue [type=voltage-pulse]
switch:RLY "relay" at (330, 170) #amber [type=relay]
buffer:BUF "schmitt" at (560, 170) #cyan [type=schmitt]
flipflop:JK "J-K" at (790, 170) #purple [type=jk]
```

Each of those is the same option name doing four different jobs, because `type` is resolved against the family. That is why `type=jk` on a `switch` is an error and not a shrug.

<!-- /schemd-section -->
