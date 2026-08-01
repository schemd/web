<!-- schemd-doc: id=overview; label=Quickstart; title=Start with schemd 0.7; summary=Compile multi-domain engineering diagrams into deterministic accessible SVG, and inspect the circuit behind them.; category=Get started; order=10 -->

`schemd` is pronounced like _“skemd”_ (`/skɛmd/`). Version 0.7 lays a contended bundle out as a set once retrying is exhausted, which carries a full reversal bus to thirty-two wires and reports itself in `routing.nudged`.

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
source:SENS "V_{sens}" at (80, 160) #blue [type=voltage-dc]
amplifier:A8 "INA, G = 100" at (300, 160) #cyan [type=opamp]
resistor:RF8 "2.2 k\Omega" at (520, 160) #amber
junction:NDE "f_c" at (690, 160) #cyan
capacitor:CC8 "4.7 nF" at (690, 280) #cyan [orientation=down]
ground:AGD "AGND" at (400, 350) #slate
port:ADC "to ADC" at (890, 160) #emerald

SENS.positive -> A8.positive #blue [ortho]
SENS.negative -> AGD.in #slate [ortho]
A8.out -> RF8.in #cyan [line]
RF8.out -> NDE.node #amber [line]
NDE.node -> CC8.in #cyan [ortho]
CC8.out -> AGD.in #cyan [ortho]
NDE.node -> ADC.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=migrate; eyebrow=02 / Migration; title=Move to 0.7 deliberately; example-title=Canonical gate terminals; example-summary=A gate wired through the `out` alias still emits `out1`. -->

Existing documents keep compiling. Two changes are worth reading before we lean on them.

**A port alias is accepted, not preserved.** We may still write `R1.r` or `X1.out`; 0.5 rewrites both endpoints to the terminal they resolve to before topology, the netlist, and the design rules ever see them. That is what makes `R1.out -> A.in` and `R1.r -> B.in` one net rather than two colliding ones. The consequence is concrete: anything a host keys on the spelling we typed — an overlay, a hover card, a simulation timeline — must key on the emitted name instead. `canonicalPortName` is exported so we can ask for the same answer the compiler used.

**The component and connection ceilings are gone.** `MAX_SCHEMATIC_COMPONENTS`, `MAX_SCHEMATIC_CONNECTIONS`, and their `SCHEMATIC_LIMITS` entries were removed; the compiler is linear in both, and sixty-four thousand components compile in about a second. A per-compilation `limits` option replaces them — see [resource budgets](/docs/0.7/limits).

```schemd bounds="820x300" title="Canonical gate terminals"
port:S "S" at (70, 100) #cyan
port:T "T" at (70, 210) #cyan
nor:N8 "\overline{S \lor T}" at (360, 155) #purple
port:W "W" at (720, 155) #emerald

S.out -> N8.in1 #cyan [line]
T.out -> N8.in2 #cyan [line]
N8.out -> W.in #emerald [line marker-end=arrow]
```

That last connection is written with the `out` alias and emits `data-wire-source="X1.out1"`. Open it in the [playground](/playground/0.7.0) and read the raw SVG if that matters to us.

<!-- /schemd-section -->

<!-- schemd-section: id=limitations; eyebrow=03 / Boundaries; title=Read this before trusting a clean compile; example-title=Two nets, one crossing; example-summary=Separate nets bridge at a crossing; one net stays continuous. -->

A document that compiles is a drawing the compiler could place and route. It is not a claim that the circuit works. The failure mode of a tool like this is a confident picture of something wrong, so here is where the confidence stops.

- **`verifyNetlist` is structural linting, not verification.** It runs deterministic rules over a flat connectivity model. It establishes nothing about analog correctness, timing, impedance, drive strength, metastability, quantum validity, or behaviour. A clean result means no rule fired.
- **Routing is greedy, then retried, then bundled — and still bounded.** Each trace is placed against the ones already laid, so the first pass is order-dependent. When one cannot be placed the router tears up what it has laid and retries, which carries a full reversal bus to twelve wires; when the retry budget is spent it lays the bundle out as a set instead, which reaches thirty-two. A document that needs that last path says so in `routing.nudged`. None of this is a general router: past what the channel model holds, a route can still be rejected because of a choice made earlier rather than because no arrangement exists.
- **The model is flat.** No hierarchy, no sub-sheets, no simulation, no standards conformance. That suits documentation, teaching, and schematics-as-source — not large engineering designs.
- **Descriptions report connectivity, not intent.** `describeSchematic` states what the netlist proves and deliberately names no archetype, because a confident wrong label is worse for a screen-reader user than an accurate structural one.
- **Published performance figures are narrow.** Warm medians on one Apple Silicon and Node configuration. Run `bun run benchmark` on our own hardware.

```schemd bounds="880x360" title="Two nets, one crossing"
port:CA "CLKA" at (70, 110) #cyan
port:CB "CLKB" at (70, 250) #purple
port:CAO "CLKA'" at (790, 250) #cyan
port:CBO "CLKB'" at (790, 110) #emerald

CA.out -> CAO.in #cyan [ortho net=CHAN_A]
CB.out -> CBO.in #purple [ortho net=CHAN_B]
```

Those two traces must cross, and they belong to different nets — so the compiler draws a bridge rather than a junction. Had they carried the same `net=`, the crossing would have stayed continuous, because then it would be one conductor.

<!-- /schemd-section -->
