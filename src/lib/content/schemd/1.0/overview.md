<!-- schemd-doc: id=overview; label=Quickstart; title=Start with schemd 1.0; summary=Compile multi-domain engineering diagrams into routed, deterministic, accessible SVG, and inspect the circuit behind them.; category=Get started; order=10 -->

`schemd` is pronounced like _“skemd”_ (`/skɛmd/`). Version 1.0 rebuilds the compiler's core behind the same language and the same API. We write the same declarations we wrote for 0.8; what changes is the drawing. Every net is routed as one tree, wires written to a [junction](/docs/1.0/nets) meet at it, a wire crossing its own net is dotted, text is measured rather than estimated, and every problem in a document can be reported at once with its [columns](/docs/1.0/diagnostics).

<!-- schemd-section: id=install; eyebrow=01 / Install; title=Compile on the server; example-title=Thermocouple front end; example-summary=A thermocouple into an instrumentation amplifier, an RC anti-alias filter, and the converter. -->

Install the compiler and hand it a string. There is no DOM to wait for, no font to load, no layout pass to measure — so this runs during a build, inside a request handler, in a browser worker, or in a test.

```sh
npm i @schemd/core
```

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="960x560" title="Front end"')!;
const { svg, document, metrics, sourceMap, routing } = compileSchematic(source, fence);
```

Several things come back from one pass. `svg` is the vector and `document` the validated model behind it; `metrics` is what the compilation cost; `sourceMap` ties every part and wire to the line that declared it; and `routing` says how hard the router had to work. The model is never re-derived by parsing our own output.

The diagram beside this is a thermocouple front end: a millivolt source into an instrumentation amplifier, a single-pole anti-alias filter, then the converter. Because the topology is declared rather than drawn, we can reason about it. The filter's corner sits at

$$
f_c = \frac{1}{2\pi R_a C_a}
$$

and with $R_a = 3.3\,\text{k}\Omega$ and $C_a = 2.2\,\text{nF}$ that lands near $21.9\ \text{kHz}$ — clear of a thermocouple's slow signal, below half the sample rate.

```schemd bounds="960x560" title="Thermocouple front end"
source:TC "V_{tc}" at (80, 157) #blue [type=voltage-dc]
amplifier:AMP "G = 100" at (300, 170) #cyan [type=instrumentation]
resistor:RA "3.3 k\Omega" at (520, 170) #amber
junction:NA "f_c" at (680, 170) #cyan
capacitor:CA "2.2 nF" at (680, 290) #cyan [orientation=down]
ground:AG "AGND" at (680, 480) #slate
port:ADC "to ADC" at (880, 170) #emerald

TC.positive -> AMP.positive #blue [ortho]
TC.negative -> AG.in #slate [ortho]
AMP.out -> RA.in #cyan [ortho]
RA.out -> NA.node #amber [ortho]
NA.node -> CA.in #cyan [ortho]
CA.out -> AG.in #slate [ortho]
NA.node -> ADC.in #emerald [ortho marker-end=arrow]
```

Notice the three wires at `NA`. Each one runs straight into the junction, because a junction part is where its author chose to join them.

<!-- /schemd-section -->

<!-- schemd-section: id=migrate; eyebrow=02 / Migration; title=Move to 1.0 deliberately; example-title=One rail, one tree; example-summary=A regulator feeding three loads, drawn as a tree without any trunk option. -->

The language is read exactly as before — 1.0's front end is 0.8's declaration patterns — and of the compiler corpus's 54 rejections under 0.8, 52 are byte-identical in 1.0. The drawings change, because the router is new. Four things are worth knowing before we upgrade.

**Every multi-terminal net is a tree.** Connections that share a terminal are grown as one tree: the first runs terminal to terminal, and every later one leaves the copper the net already has, with a junction dot. `trunk` is still parsed and recorded, but the drawing no longer depends on it — the rail beside this declares none.

**A flip-flop accepts only its own letters.** 0.8 drew distinct terminals at one point — a flip-flop's `j` and `k`, `q` and `nq` — and accepted any flip-flop letter on any variant. In 1.0 every terminal of a digital block has a slot of its own, so `j` on a D flip-flop is rejected with its line.

**A line or Bézier wire through another part's terminal is rejected.** It would read as a connection it is not. An orthogonal wire is routed around instead.

**The compiler is larger.** The compile path is 41.7 KiB gzip, about 4.5 KiB more than 0.8, paid for routing by net, exact integer geometry, measured text, and the diagnostics model. A host that counts bytes should know before upgrading.

```schemd bounds="840x480" title="One rail, one tree"
source:LDO "3V3" at (100, 240) #blue [type=voltage-dc]
load:SEN "sensor" at (460, 110) #emerald [type=lamp]
load:RAD "radio" at (460, 240) #emerald [type=buzzer]
load:MOT "fan" at (460, 370) #emerald [type=motor]

LDO.positive -> SEN.in #blue [ortho]
LDO.positive -> RAD.in #blue [ortho]
LDO.positive -> MOT.in #blue [ortho]
```

The three connections share `LDO.positive`, so they are one net and one tree: the second and third leave the copper the first laid, and each join gets a dot.

<!-- /schemd-section -->

<!-- schemd-section: id=limitations; eyebrow=03 / Boundaries; title=Read this before trusting a clean compile; example-title=Clock over data; example-summary=Separate nets bridge where they cross; one net dotted where it crosses itself. -->

A document that compiles is a drawing the compiler could place and route. It is not a claim that the circuit works. The failure mode of a tool like this is a confident picture of something wrong, so here is where the confidence stops.

- **`verifyNetlist` is structural linting, not verification.** It runs deterministic rules over a flat connectivity model. It establishes nothing about analog correctness, timing, impedance, drive strength, metastability, quantum validity, or behaviour. A clean result means no rule fired.
- **Routing is heuristic and bounded.** Each net is routed once on a channel lattice in an order taken from the geometry, never from declaration order, and any contention left over is negotiated away for a bounded number of rounds. Wires land where a draughtsman would put them in the common cases, not provably optimally, and a document crowded beyond what the lattice can separate is rejected with the wire that could not be placed.
- **Text is placed without regard to its neighbours.** A label sits at its part's fixed anchor, so on a crowded sheet it can overlap another part or a wire. Space parts by at least a label's width.
- **Several arrowed wires converging on one pin can meet four ways there.** An arrowhead never lands on a junction, so each arrowed connection keeps its own path to the pin.
- **The model is flat underneath.** Sub-circuits are expanded into ordinary parts before anything else reads the document, so the netlist, the SVG and the decompiler all see the flattened drawing. There are no sub-sheets, no ports between pages, no simulation, and no standards conformance.
- **Descriptions report connectivity, not intent.** `describeSchematic` states what the netlist proves and deliberately names no archetype.
- **Published performance figures are narrow.** Warm medians on one machine. Run `bun run benchmark` on our own hardware.

```schemd bounds="840x470" title="Clock over data"
port:D0 "D_0" at (100, 180) #amber
port:D0O "D_0'" at (720, 180) #amber
port:D1 "D_1" at (100, 280) #amber
port:D1O "D_1'" at (720, 280) #amber
port:BR "BR" at (330, 75) #amber [orientation=down]
port:BRO "BR'" at (330, 390) #amber [orientation=up]
port:CK "CLK" at (500, 75) #violet [orientation=down]
port:CKO "CLK'" at (500, 390) #violet [orientation=up]

D0.out -> D0O.in #amber [ortho net=DATA]
D1.out -> D1O.in #amber [ortho net=DATA]
BR.out -> BRO.out #amber [ortho net=DATA]
CK.out -> CKO.out #violet [ortho net=CLK]
```

The clock belongs to a different net, so where it crosses the data it hops on its vertical run. The vertical data wire belongs to the same net as the two it crosses — they are one conductor — so each crossing is marked with a dot instead.

<!-- /schemd-section -->
