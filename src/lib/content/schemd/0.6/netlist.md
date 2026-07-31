<!-- schemd-doc: id=netlist; label=Netlist API; title=Inspect the circuit, not just the drawing; summary=Extract nodes, nets, and edges from a validated document and check seven design rules against them.; category=Author diagrams; order=45 -->

Every other text-to-diagram tool stops at a picture. This one does not have to: the parser already resolves net topology and the layout pass already enumerates ports, so the source that renders can also be inspected. `buildNetlist` returns that connectivity, `verifyNetlist` runs design rules over it, and `inspectSchematic` does both in one call. All three are pure — no rendering, no geometry, no I/O.

<!-- schemd-section: id=model; eyebrow=01 / Model; title=What the compiler already knows; example-title=Supply, resistor, and return -->

A netlist has three parts. `nodes` are the declared components with their stable port names. `nets` are the sets of terminals the document ties together, carrying the author's net name where one was given, the signal domains and bus widths observed on the net, and the source lines that contributed to it. `edges` are the declared connections themselves, kept so that a diagnostic can point at the line that caused it.

Terminals that share an exact node are one net, exactly as the renderer sees them:

```schemd bounds="900x400" title="Supply, resistor, and return"
source:V1 "AC" at (110, 150) #blue [type=voltage-ac]
resistor:R1 "1 k\Omega" at (390, 150) #amber
ground:GND "0 V" at (680, 150) #slate

V1.positive -> R1.in #blue [line]
R1.out -> GND.in #slate [line]
V1.negative -> GND.in #slate [ortho]
```

```ts
import { inspectSchematic, parseSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="900x400" title="Supply"')!;
const { netlist, diagnostics } = inspectSchematic(parseSchematic(source, fence));

netlist.nodes[0].ports; // ['negative', 'positive']
netlist.nets.length; // 2
diagnostics; // []
```

<!-- /schemd-section -->

<!-- schemd-section: id=rules; eyebrow=02 / Rules; title=Seven checks, each with a stable code; example-title=A shorted rail -->

Diagnostics carry a code you can assert against, a severity, the subjects involved, and the source line wherever a declaration owns the fault. They arrive ordered by severity, then line, then code, so the output of a check is stable enough for a snapshot test or a CI log.

| Code                      | Severity  | Fails when                                                                       |
| ------------------------- | --------- | -------------------------------------------------------------------------------- |
| `shorted-supply`          | `error`   | Two supply rails — a source positive, a power rail, or a ground — share one net. |
| `width-mismatch`          | `error`   | One net carries connections declaring different bus widths.                      |
| `domain-mismatch`         | `error`   | One net mixes signal domains, such as quantum and digital.                       |
| `unconnected-component`   | `warning` | A declared component takes part in no connection.                                |
| `duplicate-connection`    | `warning` | The same pair of terminals is connected more than once.                          |
| `multiple-drivers`        | `warning` | Two digital outputs drive the same net.                                          |
| `disconnected-subcircuit` | `info`    | The diagram contains more than one independent connected group.                  |

The diagram below ties the supply straight to ground through a shared net name. It renders — the geometry is legal — but it does not pass:

<!-- schemd-expect: shorted-supply -->

```schemd bounds="900x400" title="A shorted rail"
source:V1 "AC" at (110, 150) #blue [type=voltage-ac]
resistor:R1 "1 k\Omega" at (390, 150) #amber
ground:GND "0 V" at (680, 150) #slate

V1.positive -> R1.in #blue [line net=rail]
R1.out -> GND.in #slate [line net=rail]
```

```text
error  shorted-supply  line 5  Net rail ties supply rails V1, GND together.
```

<!-- /schemd-section -->

<!-- schemd-section: id=discipline; eyebrow=03 / Discipline; title=Why the rules stay narrow; example-title=Two outputs, one node -->

A checker that cries wolf is worse than no checker, so each rule is deliberately conservative.

A source's `negative` terminal sharing a node with ground is the return path of nearly every circuit ever drawn — so only two _rails_ on one net count as a short, never a rail and a return. Two analog terminals sharing a node is ordinary topology, not contention — so `multiple-drivers` applies to digital domains only. A component with unused ports is normal; only a component that takes part in no connection at all is worth mentioning.

The diagram below is contention, because the domain says so:

<!-- schemd-expect: multiple-drivers -->

```schemd bounds="900x460" title="Two outputs, one node"
port:A "A" at (110, 150) #blue
port:B "B" at (110, 330) #blue
and:G1 "AND" at (470, 240) #purple

A.out -> G1.in1 #blue [digital]
B.out -> G1.in1 #blue [digital]
```

```text
warning  multiple-drivers  line 5  Net $1 is driven by A.out, B.out.
```

`SCHEMATIC_RULES` publishes every code with its severity and one-line summary, so a host can render this table, filter by severity, or fail a build on errors alone without hard-coding strings.

<!-- /schemd-section -->
