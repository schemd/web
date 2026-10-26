<!-- schemd-doc: id=netlist; label=Netlist API; title=Inspect the circuit, not just the drawing; summary=Extract nodes, nets, and edges from a validated document and check seven design rules against them.; category=Author diagrams; order=45 -->

Most text-to-diagram tools stop at a picture. schemd need not, because the parser already resolves the net topology and the layout pass already lists the ports, so the source that renders can also be inspected. `buildNetlist` returns that connectivity and `verifyNetlist` runs design rules over it. `inspectSchematic` does both in one call. All three are pure functions that render nothing, compute no geometry and perform no I/O.

<!-- schemd-section: id=model; eyebrow=01 / Model; title=What the compiler already knows; example-title=Supply, heater and return -->

A netlist has three parts. `nodes` are the declared components with their stable port names. `nets` are the sets of terminals the document ties together. Each net carries the author's net name where one was given, the signal domains and bus widths observed on it, and the source lines that contributed to it. `edges` are the declared connections themselves, kept so that a diagnostic can point at the line that caused it.

Terminals that share an exact node are one net, exactly as the renderer sees them. How a net is drawn changes nothing here. Every multi-terminal net is drawn as a [tree](/docs/1.3/nets), and a wire that crosses its own net gets a dot, yet every point on that copper is the same node. The nets, edges and rule results therefore depend only on what was declared. A part declared without a label appears with an empty `label`.

```schemd bounds="900x400" title="Supply, heater and return"
source:VH2 "48 V" at (110, 150) #blue [type=voltage-dc]
load:HT2 "heater" at (390, 150) #amber [type=lamp]
ground:HR2 "return" at (680, 150) #slate

VH2.positive -> HT2.in #blue [line]
HT2.out -> HR2.in #slate [line]
VH2.negative -> HR2.in #slate [ortho]
```

```ts
import { inspectSchematic, parseSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="900x400" title="Heater"')!;
const { netlist, diagnostics } = inspectSchematic(parseSchematic(source, fence));

netlist.nodes[0].ports; // ['negative', 'positive']
netlist.nets.length; // 2
diagnostics; // []
```

<!-- /schemd-section -->

<!-- schemd-section: id=rules; eyebrow=02 / Rules; title=Seven checks, each with a stable code; example-title=A shorted rail -->

A diagnostic carries a code to assert against, a severity and the subjects involved. It also carries the source line wherever a declaration owns the fault. Diagnostics arrive ordered by severity, then line, then code, so the output of a check is stable enough for a snapshot test or a CI log.

| Code                      | Severity  | Fails when                                                                    |
| ------------------------- | --------- | ----------------------------------------------------------------------------- |
| `shorted-supply`          | `error`   | Two supply rails (a source positive, a power rail or a ground) share one net. |
| `width-mismatch`          | `error`   | One net carries connections declaring different bus widths.                   |
| `domain-mismatch`         | `error`   | One net mixes signal domains, such as quantum and digital.                    |
| `unconnected-component`   | `warning` | A declared component takes part in no connection.                             |
| `duplicate-connection`    | `warning` | The same pair of terminals is connected more than once.                       |
| `multiple-drivers`        | `warning` | Two digital outputs drive the same net.                                       |
| `disconnected-subcircuit` | `info`    | The diagram contains more than one independent connected group.               |

The diagram below ties the supply straight to ground through a shared net name. It renders, because the geometry is legal, but it does not pass:

<!-- schemd-expect: shorted-supply -->

```schemd bounds="900x400" title="A shorted rail"
source:VH2 "48 V" at (110, 150) #blue [type=voltage-dc]
load:HT2 "heater" at (390, 150) #amber [type=lamp]
ground:HR2 "return" at (680, 150) #slate

VH2.positive -> HT2.in #blue [line net=v48]
HT2.out -> HR2.in #slate [line net=v48]
```

```text
error  shorted-supply  line 5  Net v48 ties supply rails VH2, HR2 together.
```

<!-- /schemd-section -->

<!-- schemd-section: id=discipline; eyebrow=03 / Discipline; title=Why the rules stay narrow; example-title=Two outputs, one node -->

A checker that raises false alarms is worse than no checker, so each rule is deliberately conservative.

A source's `negative` terminal sharing a node with ground is the return path of nearly every circuit ever drawn. Only two rails on one net count as a short; a rail and its return never do. Two analog terminals that share a node are ordinary topology and no contention, so `multiple-drivers` applies to digital domains only. Unused ports on a component are normal too. Only a component that takes part in no connection at all is worth a warning.

The diagram below is contention, because its domain says so:

<!-- schemd-expect: multiple-drivers -->

```schemd bounds="900x460" title="Two outputs, one node"
port:IRQA "IRQ_A" at (110, 150) #violet
port:IRQB "IRQ_B" at (110, 330) #violet
nor:G7N "NOR" at (470, 240) #purple

IRQA.out -> G7N.in1 #violet [digital]
IRQB.out -> G7N.in1 #violet [digital]
```

```text
warning  multiple-drivers  line 5  Net $1 is driven by IRQA.out, IRQB.out.
```

`SCHEMATIC_RULES` publishes every code with its severity and a one-line summary. A host can render this table from it, filter by severity, or fail a build on errors alone, all without hard-coding strings.

<!-- /schemd-section -->
