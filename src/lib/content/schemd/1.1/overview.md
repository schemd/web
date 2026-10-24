<!-- schemd-doc: id=overview; label=Quickstart; title=Start with schemd 1.1; summary=Compile multi-domain engineering diagrams into routed, deterministic, accessible SVG, and inspect the circuit behind them.; category=Get started; order=10 -->

`schemd` is pronounced like _“skemd”_ (`/skɛmd/`). Version 1.1 lets a part take its height from its wires: [`fit=wires`](/docs/1.1/fit) lines a CNOT's rails up with its qubits and an IC's pins up with the wires that feed them, and an alignment can now line up a [terminal](/docs/1.1/placement#terminals) rather than a centre. Underneath is 1.0's compiler — every net routed as one tree, wires that meet at a [junction](/docs/1.1/nets) part, text measured rather than estimated, and every problem in a document reported at once with its [columns](/docs/1.1/diagnostics).

<!-- schemd-section: id=install; eyebrow=01 / Install; title=Compile on the server; example-title=Photodiode front end; example-summary=A photodiode into a transimpedance amplifier, an RC anti-alias filter, and the converter. -->

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

The diagram beside this is a photodiode front end: the diode's current into a transimpedance amplifier whose feedback resistor turns it into a voltage, a single-pole anti-alias filter, then the converter. Because the topology is declared rather than drawn, we can reason about it. The filter's corner sits at

$$
f_c = \frac{1}{2\pi R_a C_b}
$$

and with $R_a = 1.5\,\text{k}\Omega$ and $C_b = 4.7\,\text{nF}$ that lands near $22.6\ \text{kHz}$ — above the light signal we care about, below half the sample rate.

```schemd bounds="960x560" title="Photodiode front end"
source:PD "I_{pd}" at (90, 170) #blue [type=current-dc orientation=up]
amplifier:TIA "TIA" at (330, 190) #cyan [type=opamp]
resistor:RF "100 k\Omega" at (330, 70) #amber
resistor:RA "1.5 k\Omega" at (560, 190) #amber
junction:NB "f_c" at (720, 190) #cyan
capacitor:CB "4.7 nF" at (720, 320) #cyan [orientation=down]
ground:BG "AGND" at (720, 480) #slate
port:ADC2 "to ADC" at (890, 190) #emerald

PD.positive -> TIA.negative #blue [ortho]
PD.negative -> BG.in #slate [ortho]
TIA.out -> RF.out #amber [ortho]
RF.in -> TIA.negative #amber [ortho]
TIA.out -> RA.in #cyan [ortho]
RA.out -> NB.node #amber [ortho]
NB.node -> CB.in #cyan [ortho]
CB.out -> BG.in #slate [ortho]
NB.node -> ADC2.in #emerald [ortho marker-end=arrow]
```

Notice the three wires at `NB`. Each one runs straight into the junction, because a junction part is where its author chose to join them.

<!-- /schemd-section -->

<!-- schemd-section: id=migrate; eyebrow=02 / Migration; title=Move to 1.1 without redrawing anything; example-title=Bell pair, fitted; example-summary=One option, and the CNOT's rails sit on the qubits. -->

1.1 adds; it does not redraw. Every 1.0 document compiles to the same bytes — the compiler's 270-document corpus is byte-identical to 1.0.2 — and fitting happens only where a document asks for it. Three things are still worth knowing before we upgrade.

**Two new things to write.** `fit=wires` on a [multi-qubit gate or a block](/docs/1.1/fit) lines its terminals up with their wires, and `aligned-y with B.out at in2` places a part by one of its own [terminals](/docs/1.1/placement#terminals). Both are opt-in.

**One terminal faces a new way.** The vertical terminal on the lowest rail of a `cz`, `cphase`, `toffoli`, `controlled` or `swap` now faces down. It faced up, so a wire to it ran through every terminal above it. A host that reads `resolvePortGeometry(...).normal` for those terminals sees the change; no drawing in the corpus wires one.

**A crash is gone.** A repeated connection between two junction ends, on a net whose copper ran straight through one of them, threw a `TypeError` instead of a diagnostic. It now draws along the copper. The compile path is 43.6 KiB gzip, 1.8 KiB more than 1.0.2, for fitting, terminal alignment and their diagnostics.

```schemd bounds="860x380" title="Bell pair, fitted"
prepare:BA "|0\rangle" at (90, 110) #blue
prepare:BB "|0\rangle" at (90, 250) #blue
hadamard:HB2 "H" at (260, 110) #cyan
cnot:BX "CNOT" at (470, 180) #purple [fit=wires]
measure:MBA "M_a" at (720, 110) #emerald
measure:MBB "M_b" at (720, 250) #emerald

BA.out -> HB2.in #blue [ortho]
HB2.out -> BX.in1 #cyan [ortho]
BB.out -> BX.in2 #blue [ortho]
BX.out1 -> MBA.in #purple [ortho]
BX.out2 -> MBB.in #purple [ortho]
```

Without `fit=wires` the same circuit jogs both qubits in to the CNOT's fixed 18-unit rails and out again. With it, the rails sit 140 units apart, on the qubits, and every wire is one straight run.

<!-- /schemd-section -->

<!-- schemd-section: id=limitations; eyebrow=03 / Boundaries; title=Read this before trusting a clean compile; example-title=Chip select over address; example-summary=Separate nets bridge where they cross; one net dotted where it crosses itself. -->

A document that compiles is a drawing the compiler could place and route. It is not a claim that the circuit works. The failure mode of a tool like this is a confident picture of something wrong, so here is where the confidence stops.

- **`verifyNetlist` is structural linting, not verification.** It runs deterministic rules over a flat connectivity model. It establishes nothing about analog correctness, timing, impedance, drive strength, metastability, quantum validity, or behaviour. A clean result means no rule fired.
- **Routing is heuristic and bounded.** Each net is routed once on a channel lattice in an order taken from the geometry, never from declaration order, and any contention left over is negotiated away for a bounded number of rounds. Wires land where a draughtsman would put them in the common cases, not provably optimally, and a document crowded beyond what the lattice can separate is rejected with the wire that could not be placed.
- **Text is placed without regard to its neighbours.** A label sits at its part's fixed anchor, so on a crowded sheet it can overlap another part or a wire. Space parts by at least a label's width.
- **Several arrowed wires converging on one pin can meet four ways there.** An arrowhead never lands on a junction, so each arrowed connection keeps its own path to the pin.
- **Two wires of one net can occasionally overlap on one run.** A wide random search found it twice in 8,000 layouts; the drawing still connects what it should.
- **A fitted part is placed before it fits.** Relative placement measures a `fit=wires` part from its unfitted shape, so leave its neighbours room.
- **The model is flat underneath.** Sub-circuits are expanded into ordinary parts before anything else reads the document, so the netlist, the SVG and the decompiler all see the flattened drawing. There are no sub-sheets, no ports between pages, no simulation, and no standards conformance.
- **Descriptions report connectivity, not intent.** `describeSchematic` states what the netlist proves and deliberately names no archetype.
- **Published performance figures are narrow.** Warm medians on one machine. Run `bun run benchmark` on our own hardware.

```schemd bounds="840x470" title="Chip select over address"
port:AD0 "A_0" at (100, 170) #emerald
port:AD0O "A_0'" at (720, 170) #emerald
port:AD1 "A_1" at (100, 290) #emerald
port:AD1O "A_1'" at (720, 290) #emerald
port:JMP "jump" at (300, 75) #emerald [orientation=down]
port:JMPO "jump'" at (300, 395) #emerald [orientation=up]
port:CS "CS" at (520, 75) #rose [orientation=down]
port:CSO "CS'" at (520, 395) #rose [orientation=up]

AD0.out -> AD0O.in #emerald [ortho net=ADDRESS]
AD1.out -> AD1O.in #emerald [ortho net=ADDRESS]
JMP.out -> JMPO.out #emerald [ortho net=ADDRESS]
CS.out -> CSO.out #rose [ortho net=SELECT]
```

The chip select belongs to a different net, so where it crosses the address lines it hops on its vertical run. The vertical jumper belongs to the same net as the two lines it crosses — they are one conductor — so each crossing is marked with a dot instead.

<!-- /schemd-section -->
