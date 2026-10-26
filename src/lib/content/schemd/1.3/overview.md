<!-- schemd-doc: id=overview; label=Quickstart; title=Start with schemd 1.3; summary=Compile multi-domain engineering diagrams into routed, deterministic, accessible SVG, and inspect the circuit behind them.; category=Get started; order=10 -->

`schemd` is pronounced "skemd" (`/skɛmd/`). Version 1.3 states what every component kind accepts as data, in a new entry, `@schemd/core/schema`, and this site prints a [datasheet](/components) for each kind from it. It keeps optional labels from 1.2, so a junction or a test point can draw its designator alone, and everything 1.1 added: [`fit=wires`](/docs/1.3/fit) lines a CNOT's rails up with its qubits and an IC's pins up with the wires that feed them, and an alignment can place a [terminal](/docs/1.3/placement#terminals) level with another part. Underneath is the 1.0 compiler. Each net is routed as one tree, and wires meet at a [junction](/docs/1.3/nets) part. Text is measured from font advances, and every problem in a document is reported at once, with its [columns](/docs/1.3/diagnostics).

<!-- schemd-section: id=install; eyebrow=01 / Install; title=Compile on the server; example-title=Microphone preamplifier; example-summary=A coupling capacitor, a bias resistor and a non-inverting amplifier with a gain of about 46. -->

The compiler is installed from npm and given a string. It needs no DOM and no font file, so it runs during a build or inside a request handler. A browser worker or a test can call it as well.

```sh
npm i @schemd/core
```

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="1000x640" title="Microphone preamplifier"')!;
const { svg, document, metrics, sourceMap, routing } = compileSchematic(source, fence);
```

One pass returns several things. `svg` is the drawing and `document` is the validated model behind it. `metrics` records what the compilation cost, `sourceMap` ties every part and wire to the line that declared it, and `routing` reports how hard the router had to work. The model is never rebuilt by parsing the SVG back.

This figure is a microphone preamplifier. A capacitor blocks the microphone's DC level, a 100 kΩ resistor holds the amplifier's input at ground, and the amplifier raises the signal to line level. Because the circuit is declared as topology, it can be reasoned about. A non-inverting stage has a gain of

$$
A_v = 1 + \frac{R_F}{R_G}
$$

and with $R_F = 100\,\text{k}\Omega$ and $R_G = 2.2\,\text{k}\Omega$ it is about 46, or 33 dB. That suits a dynamic microphone, whose output is a few millivolts.

```schemd bounds="1000x640" title="Microphone preamplifier"
source:MIC "mic" at (90, 250) #blue [type=voltage-ac orientation=up]
capacitor:CIN "1 \mu F" at (240, 110) #cyan
junction:NB at (380, 110) #cyan
resistor:RB "100 k\Omega" at (380, 280) #amber [orientation=down]
amplifier:PRE "preamp" at (560, 130) #purple [type=opamp]
resistor:RF "100 k\Omega" at (560, 320) #amber
junction:NF at (440, 320) #purple
resistor:RG "2.2 k\Omega" at (440, 440) #amber [orientation=down]
port:OUT "line out" at (900, 130) #emerald
ground:AG at (240, 560) #slate

MIC.positive -> CIN.in #blue [ortho]
CIN.out -> NB.node #cyan [ortho]
NB.node -> PRE.positive #cyan [ortho]
NB.node -> RB.in #cyan [ortho]
PRE.out -> RF.out #purple [ortho]
RF.in -> NF.node #amber [ortho]
NF.node -> PRE.negative #purple [ortho]
NF.node -> RG.in #purple [ortho]
PRE.out -> OUT.in #emerald [ortho marker-end=arrow]
RB.out -> AG.in #slate [ortho]
RG.out -> AG.in #slate [ortho]
MIC.negative -> AG.in #slate [ortho]
```

The two junctions, `NB` and `NF`, carry no labels, so each shows only its name. Every wire that reaches them runs straight into the dot, because a junction part is the place its author chose to join them.

<!-- /schemd-section -->

<!-- schemd-section: id=migrate; eyebrow=02 / Migration; title=Move to 1.3 without redrawing anything; example-title=Two-pole RC ladder; example-summary=Two RC sections in series; the junctions and the ground carry no label. -->

1.3 adds no syntax and changes no drawing. Every 1.2 document compiles to the same bytes: the compiler's 270-document corpus is byte-identical to 1.2.0, and the compile path is exactly the size it was.

What 1.3 adds is a description of the language for tools. `@schemd/core/schema` lists every component kind with its options, and each option with its type, the values or range it accepts and its default:

```ts
import { SCHEMATIC_COMPONENT_SCHEMAS, describeComponentPorts } from '@schemd/core/schema';

SCHEMATIC_COMPONENT_SCHEMAS.mux.options.find((option) => option.name === 'inputs');
// { name: 'inputs', type: 'integer', min: 1, max: 32, default: 2, defaultsByType: { demux: 1 } }

describeComponentPorts('mux', { type: 'demux' });
// ['in1', 'out1', 'out2', 'select', 'enable']
```

An editor can list what a kind accepts without copying a table by hand, and the list cannot drift, because a test in the compiler proves it against the parser for every kind and option. Ports depend on options, so `describeComponentPorts` asks the parser itself. The schema is a separate entry, so a host that only compiles never loads it. The [component reference](/docs/1.3/component-reference#schema) says more.

If we are moving from 1.1, the [1.2 notes](/docs/1.2/overview#migrate) still apply: a part may be declared without a label, and it then draws its designator alone.

```schemd bounds="980x480" title="Two-pole RC ladder"
port:VIN "V_{in}" at (90, 120) #blue
resistor:R1 "1 k\Omega" at (250, 120) #amber
junction:N1 at (400, 120) #cyan
capacitor:C1 "100 nF" at (400, 260) #cyan [orientation=down]
resistor:R2 "10 k\Omega" at (560, 120) #amber
junction:N2 at (710, 120) #cyan
capacitor:C2 "10 nF" at (710, 260) #cyan [orientation=down]
port:VOUT "V_{out}" at (880, 120) #emerald
ground:G1 at (560, 400) #slate

VIN.out -> R1.in #blue [ortho]
R1.out -> N1.node #amber [ortho]
N1.node -> C1.in #cyan [ortho]
N1.node -> R2.in #cyan [ortho]
R2.out -> N2.node #amber [ortho]
N2.node -> C2.in #cyan [ortho]
N2.node -> VOUT.in #emerald [ortho marker-end=arrow]
C1.out -> G1.in #slate [ortho]
C2.out -> G1.in #slate [ortho]
```

Both junctions and the ground are declared without labels. The values that matter, the two resistances and the two capacitances, are the only labels on the sheet.

<!-- /schemd-section -->

<!-- schemd-section: id=limitations; eyebrow=03 / Boundaries; title=Read this before trusting a clean compile; example-title=Enable across an address bus; example-summary=An enable line bridges three address lines; a link on the address net joins them with dots. -->

A document that compiles is a drawing the compiler could place and route. It is no claim that the circuit works. A tool like this fails by drawing something wrong with confidence, so this section states where that confidence ends.

- `verifyNetlist` is structural linting and nothing more. It runs fixed rules over a flat model of the connections, and it proves nothing about analog behaviour, timing, impedance or quantum validity. A clean result means that no rule fired.
- Routing is heuristic and bounded. Each net is routed once on a channel lattice, in an order taken from the geometry and never from the order of declaration. Any contention left over is then negotiated for a bounded number of rounds. Hence the wires land where a draughtsman would put them in common cases, though not provably at the optimum. A document too crowded for the lattice is rejected, and the error names the wire that could not be placed.
- A label sits at its part's fixed anchor and takes no account of its neighbours. On a crowded sheet it can overlap another part or a wire, so parts should be spaced by at least a label's width.
- Several arrowed wires that converge on one pin can meet there from four sides. An arrowhead never lands on a junction, so each arrowed connection keeps its own path to the pin.
- Two wires of one net can now and then share a run. A wide random search found this twice in 8,000 layouts, and the drawing still connected what it should.
- A `fit=wires` part is placed before it fits. Relative placement measures it from its unfitted shape, so its neighbours need room for it to grow.
- The model is flat underneath. Sub-circuits are expanded into ordinary parts before anything else reads the document, and the netlist, the SVG and the decompiler all see that flattened drawing. There are no sub-sheets and no ports between pages. Simulation is not offered either.
- `describeSchematic` reports connectivity and deliberately names no archetype. It states what the netlist proves, not what the circuit is for.
- The published performance figures are warm medians on one machine. `bun run benchmark` gives the figures for other hardware.

```schemd bounds="860x500" title="Enable across an address bus"
port:A0 "A_0" at (100, 150) #emerald
port:A0O "A_0'" at (740, 150) #emerald
port:A1 "A_1" at (100, 240) #emerald
port:A1O "A_1'" at (740, 240) #emerald
port:A2 "A_2" at (100, 330) #emerald
port:A2O "A_2'" at (740, 330) #emerald
port:LINK "link" at (300, 75) #emerald [orientation=down]
port:LINKO "link'" at (300, 420) #emerald [orientation=up]
port:EN "EN" at (530, 75) #rose [orientation=down]
port:ENO "EN'" at (530, 420) #rose [orientation=up]

A0.out -> A0O.in #emerald [ortho net=ADDR]
A1.out -> A1O.in #emerald [ortho net=ADDR]
A2.out -> A2O.in #emerald [ortho net=ADDR]
LINK.out -> LINKO.out #emerald [ortho net=ADDR]
EN.out -> ENO.out #rose [ortho net=ENABLE]
```

The enable line belongs to another net, so it bridges each address line it crosses. The link, however, belongs to the address net itself. Its crossings are one conductor meeting itself, and each one is marked with a dot.

<!-- /schemd-section -->
