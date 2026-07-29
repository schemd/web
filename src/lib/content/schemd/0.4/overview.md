<!-- schemd-doc: id=overview; label=Quickstart; title=Start with schemd 0.4; summary=Compile multi-domain engineering diagrams into deterministic accessible SVG, and inspect the circuit behind them.; category=Get started; order=10 -->

`schemd` is pronounced like _“skemd”_ (`/skɛmd/`). Version 0.4 removes the component and connection ceilings, makes the remaining budgets configurable per compilation, and reports the canonical terminal behind every port alias.

<!-- schemd-section: id=install; eyebrow=01 / Install; title=Compile on the server; example-title=Instrumentation front end; example-summary=A bridge sensor, its instrumentation amplifier, and the anti-alias filter feeding a converter. -->

Install the compiler and hand it a string. There is no DOM to wait for, no font to load, no layout pass to measure — so this runs during a build, inside a request handler, or in a test.

```sh
npm i @schemd/core
```

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="980x420" title="Front end"')!;
const { svg, document, metrics } = compileSchematic(source, fence);
```

Three things come back: `svg` is the vector, `document` is the validated model behind it, and `metrics` is what the compilation cost. Note that we get all three from one pass — the model is never re-derived by parsing our own output.

The diagram beside this is an instrumentation front end: a bridge sensor into a differential amplifier, a single-pole anti-alias filter, then the converter. Because the topology is declared rather than drawn, we can reason about it. The filter's corner sits at

$$
f_c = \frac{1}{2\pi R_f C_f}
$$

and with $R_f = 2.2\,\text{k}\Omega$ and $C_f = 4.7\,\text{nF}$ that lands near $15.4\ \text{kHz}$ — above the signal band, below half the sample rate.

```schemd bounds="980x420" title="Instrumentation front end"
source:BRIDGE "V_{sense}" at (80, 160) #blue [type=voltage-dc]
amplifier:A1 "INA, G = 100" at (300, 160) #cyan [type=instrumentation]
resistor:RF "2.2 k\Omega" at (520, 160) #amber
junction:NODE "f_c" at (690, 160) #cyan
capacitor:CF "4.7 nF" at (690, 280) #cyan [orientation=down]
ground:GND "AGND" at (400, 350) #slate
port:ADC "to ADC" at (890, 160) #emerald

BRIDGE.positive -> A1.in #blue [ortho]
BRIDGE.negative -> GND.in #slate [ortho]
A1.out -> RF.in #cyan [line]
RF.out -> NODE.node #amber [line]
NODE.node -> CF.in #cyan [ortho]
CF.out -> GND.in #cyan [ortho]
NODE.node -> ADC.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=migrate; eyebrow=02 / Migration; title=Move to 0.4 deliberately; example-title=Canonical gate terminals; example-summary=A gate wired through the `out` alias still emits `out1`. -->

Existing documents keep compiling. Two changes are worth reading before we lean on them.

**A port alias is accepted, not preserved.** We may still write `R1.r` or `X1.out`; 0.4 rewrites both endpoints to the terminal they resolve to before topology, the netlist, and the design rules ever see them. That is what makes `R1.out -> A.in` and `R1.r -> B.in` one net rather than two colliding ones. The consequence is concrete: anything a host keys on the spelling we typed — an overlay, a hover card, a simulation timeline — must key on the emitted name instead. `canonicalPortName` is exported so we can ask for the same answer the compiler used.

**The component and connection ceilings are gone.** `MAX_SCHEMATIC_COMPONENTS`, `MAX_SCHEMATIC_CONNECTIONS`, and their `SCHEMATIC_LIMITS` entries were removed; the compiler is linear in both, and sixty-four thousand components compile in about a second. A per-compilation `limits` option replaces them — see [resource budgets](/docs/0.4/limits).

```schemd bounds="820x300" title="Canonical gate terminals"
port:A "A" at (70, 100) #blue
port:B "B" at (70, 210) #blue
xor:X1 "A \oplus B" at (360, 155) #cyan
port:Q "Q" at (720, 155) #emerald

A.out -> X1.in1 #blue [line]
B.out -> X1.in2 #blue [line]
X1.out -> Q.in #emerald [line marker-end=arrow]
```

That last connection is written with the `out` alias and emits `data-wire-source="X1.out1"`. Open it in the [0.4 playground](/playground/0.4.0) and read the raw SVG if that matters to us.

<!-- /schemd-section -->

<!-- schemd-section: id=limitations; eyebrow=03 / Boundaries; title=Read this before trusting a clean compile; example-title=Two nets, one crossing; example-summary=Separate nets bridge at a crossing; one net stays continuous. -->

A document that compiles is a drawing the compiler could place and route. It is not a claim that the circuit works. The failure mode of a tool like this is a confident picture of something wrong, so here is where the confidence stops.

- **`verifyNetlist` is structural linting, not verification.** It runs deterministic rules over a flat connectivity model. It establishes nothing about analog correctness, timing, impedance, drive strength, metastability, quantum validity, or behaviour. A clean result means no rule fired.
- **Routing is greedy and never rips up.** Each trace is placed against the ones already laid, so congestion is order-dependent: a route can be unroutable because of a choice made earlier, not because no arrangement exists.
- **The model is flat.** No hierarchy, no sub-sheets, no simulation, no standards conformance. That suits documentation, teaching, and schematics-as-source — not large engineering designs.
- **Descriptions report connectivity, not intent.** `describeSchematic` states what the netlist proves and deliberately names no archetype, because a confident wrong label is worse for a screen-reader user than an accurate structural one.
- **Published performance figures are narrow.** Warm medians on one Apple Silicon and Node configuration. Run `bun run benchmark` on our own hardware.

```schemd bounds="880x360" title="Two nets, one crossing"
port:CLK "CLK" at (70, 110) #amber
port:DATA "DATA" at (70, 250) #blue
port:CLKOUT "CLK'" at (790, 250) #amber
port:DATAOUT "DATA'" at (790, 110) #emerald

CLK.out -> CLKOUT.in #amber [ortho net=CLOCK]
DATA.out -> DATAOUT.in #blue [ortho net=PAYLOAD]
```

Those two traces must cross, and they belong to different nets — so the compiler draws a bridge rather than a junction. Had they carried the same `net=`, the crossing would have stayed continuous, because then it would be one conductor.

<!-- /schemd-section -->
