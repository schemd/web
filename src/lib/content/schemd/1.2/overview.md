<!-- schemd-doc: id=overview; label=Quickstart; title=Start with schemd 1.2; summary=Compile multi-domain engineering diagrams into routed, deterministic, accessible SVG, and inspect the circuit behind them.; category=Get started; order=10 -->

`schemd` is pronounced "skemd" (`/skɛmd/`). Version 1.2 lets a part be declared without a label, so a junction or a test point draws its designator alone. It keeps everything 1.1 added: [`fit=wires`](/docs/1.2/fit) lines a CNOT's rails up with its qubits and an IC's pins up with the wires that feed them, and an alignment can place a [terminal](/docs/1.2/placement#terminals) level with another part. Underneath is the 1.0 compiler. Each net is routed as one tree, and wires meet at a [junction](/docs/1.2/nets) part. Text is measured from font advances, and every problem in a document is reported at once, with its [columns](/docs/1.2/diagnostics).

<!-- schemd-section: id=install; eyebrow=01 / Install; title=Compile on the server; example-title=RTD signal chain; example-summary=A current source excites a platinum RTD, a buffer reads it, and an RC filter feeds the converter. -->

The compiler is installed from npm and given a string. It needs no DOM and no font file, so it runs during a build or inside a request handler. A browser worker or a test can call it as well.

```sh
npm i @schemd/core
```

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="1040x560" title="RTD signal chain"')!;
const { svg, document, metrics, sourceMap, routing } = compileSchematic(source, fence);
```

One pass returns several things. `svg` is the drawing and `document` is the validated model behind it. `metrics` records what the compilation cost, `sourceMap` ties every part and wire to the line that declared it, and `routing` reports how hard the router had to work. The model is never rebuilt by parsing the SVG back.

This figure is a temperature front end. A constant current flows through a Pt100 resistance thermometer, and a unity-gain buffer copies the voltage across it without loading the sensor. A single RC pole then limits the bandwidth before the converter samples it. Because the circuit is declared as topology, it can be reasoned about. The filter's corner sits at

$$
f_c = \frac{1}{2\pi R_F C_F}
$$

and with $R_F = 3.3\,\text{k}\Omega$ and $C_F = 10\,\text{nF}$ it lands near $4.8\ \text{kHz}$. That is far above how fast a temperature can change, so the filter removes noise and leaves the reading alone.

```schemd bounds="1040x560" title="RTD signal chain"
source:IX "I_{ex}" at (90, 250) #blue [type=current-dc orientation=up]
junction:NX at (250, 110) #blue
resistor:RT "Pt100" at (250, 290) #amber [type=thermistor orientation=down]
amplifier:BUF "buffer" at (450, 130) #cyan [type=opamp]
resistor:RF "3.3 k\Omega" at (660, 130) #amber
junction:NF at (820, 130) #cyan
capacitor:CF "10 nF" at (820, 290) #cyan [orientation=down]
ground:AG "AGND" at (820, 470) #slate
port:OUT "to ADC" at (960, 130) #emerald

IX.positive -> NX.node #blue [ortho]
NX.node -> RT.in #blue [ortho]
NX.node -> BUF.positive #blue [ortho]
BUF.out -> BUF.negative #cyan [ortho]
BUF.out -> RF.in #cyan [ortho]
RF.out -> NF.node #amber [ortho]
NF.node -> CF.in #cyan [ortho]
NF.node -> OUT.in #emerald [ortho marker-end=arrow]
CF.out -> AG.in #slate [ortho]
RT.out -> AG.in #slate [ortho]
IX.negative -> AG.in #slate [ortho]
```

The two junctions, `NX` and `NF`, are declared without labels, so each shows only its name. Every wire that reaches them runs straight into the dot, because a junction part is the place its author chose to join them.

<!-- /schemd-section -->

<!-- schemd-section: id=migrate; eyebrow=02 / Migration; title=Move to 1.2 without redrawing anything; example-title=Divider, three parts unlabelled; example-summary=A junction, a lower resistor's ground and the return carry no label text. -->

1.2 only adds. Every 1.1 document compiles to the same bytes: the compiler's 270-document corpus is byte-identical to 1.1.0. A document changes only where its author leaves a label out.

The quoted label is now optional in both declaration forms. `junction:J1 at (440, 90) #cyan` and `ground:G1 below R2 by 150 #slate` are complete declarations. Such a part draws its designator above it and nothing below, and the router no longer keeps wires clear of a label row that is not there. In the model its `label` is the empty string. Its accessible name in `full` mode reads `J1, junction`, `describeSchematic` names it by its ID, and `parseSchematicSvg` reads it back without a label.

An empty pair of quotes, `""`, is still rejected. A part with something to say should say it; a part with nothing to say leaves the quotes out.

The compile path is 44,637 bytes gzip, which is 35 bytes more than 1.1.0. If we are moving from 1.0, the [1.1 notes](/docs/1.1/overview#migrate) still apply: `fit=wires`, terminal alignment, and the vertical terminal on a multi-track gate's lowest rail facing down.

```schemd bounds="760x480" title="Divider, three parts unlabelled"
source:VS "12 V" at (100, 210) #blue [type=voltage-dc orientation=up]
resistor:R1 "10 k\Omega" at (270, 90) #amber
junction:J1 at (440, 90) #cyan
resistor:R2 "4.7 k\Omega" at (440, 240) #amber [orientation=down]
port:VO "V_{out}" at (640, 90) #emerald
ground:G1 at (440, 410) #slate

VS.positive -> R1.in #blue [ortho]
R1.out -> J1.node #amber [ortho]
J1.node -> R2.in #cyan [ortho]
J1.node -> VO.in #emerald [ortho marker-end=arrow]
R2.out -> G1.in #slate [ortho]
VS.negative -> G1.in #slate [ortho]
```

Before 1.2 the junction had to be written `junction:J1 "J1"`, and its name was drawn twice. Here the only labels on the sheet are the supply voltage and the two resistances.

<!-- /schemd-section -->

<!-- schemd-section: id=limitations; eyebrow=03 / Boundaries; title=Read this before trusting a clean compile; example-title=Clock across a data bus; example-summary=A clock line bridges three data lines; a tap on the data net joins them with dots. -->

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

```schemd bounds="840x520" title="Clock across a data bus"
port:D0 "D_0" at (100, 160) #emerald
port:D0O "D_0'" at (720, 160) #emerald
port:D1 "D_1" at (100, 260) #emerald
port:D1O "D_1'" at (720, 260) #emerald
port:D2 "D_2" at (100, 360) #emerald
port:D2O "D_2'" at (720, 360) #emerald
port:TAP "tap" at (270, 70) #emerald [orientation=down]
port:TAPO "tap'" at (270, 450) #emerald [orientation=up]
port:CLK "CLK" at (500, 70) #amber [orientation=down]
port:CLKO "CLK'" at (500, 450) #amber [orientation=up]

D0.out -> D0O.in #emerald [ortho net=DATA]
D1.out -> D1O.in #emerald [ortho net=DATA]
D2.out -> D2O.in #emerald [ortho net=DATA]
TAP.out -> TAPO.out #emerald [ortho net=DATA]
CLK.out -> CLKO.out #amber [ortho net=CLOCK]
```

The clock belongs to another net, so it bridges each data line it crosses. The tap, however, belongs to the data net itself. Its crossings are one conductor meeting itself, and each one is marked with a dot.

<!-- /schemd-section -->
