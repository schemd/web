<!-- schemd-doc: id=overview; label=Quickstart; title=Start with schemd 0.8; summary=Compile multi-domain engineering diagrams into deterministic accessible SVG, and inspect the circuit behind them.; category=Get started; order=10 -->

`schemd` is pronounced like _“skemd”_ (`/skɛmd/`). Version 0.8 adds two pieces of syntax and makes the router faster. A multi-terminal net can be drawn as a tree with `trunk`, a block we draw more than once can be written once as a [sub-circuit](/docs/0.8/subcircuits) and placed by name, and the sparse router prices each grid edge once per route, which compiles a contended bus about one and a half times faster with byte-identical output.

<!-- schemd-section: id=install; eyebrow=01 / Install; title=Compile on the server; example-title=Strain-gauge front end; example-summary=A gauge, its instrumentation amplifier, and the anti-alias filter feeding a converter. -->

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

The diagram beside this is a strain-gauge front end: the gauge into a differential amplifier, a single-pole anti-alias filter, then the converter. Because the topology is declared rather than drawn, we can reason about it. The filter's corner sits at

$$
f_c = \frac{1}{2\pi R_f C_f}
$$

and with $R_f = 1.5\,\text{k}\Omega$ and $C_f = 10\,\text{nF}$ that lands near $10.6\ \text{kHz}$ — above the signal band, below half the sample rate.

```schemd bounds="980x420" title="Strain-gauge front end"
source:GAUGE "V_{gauge}" at (80, 160) #blue [type=voltage-dc]
amplifier:INA "INA, G = 200" at (300, 160) #cyan [type=opamp]
resistor:RF "1.5 k\Omega" at (520, 160) #amber
junction:FC "f_c" at (690, 160) #cyan
capacitor:CF "10 nF" at (690, 280) #cyan [orientation=down]
ground:AGND "AGND" at (400, 350) #slate
port:CONV "to ADC" at (890, 160) #emerald

GAUGE.positive -> INA.positive #blue [ortho]
GAUGE.negative -> AGND.in #slate [ortho]
INA.out -> RF.in #cyan [line]
RF.out -> FC.node #amber [line]
FC.node -> CF.in #cyan [ortho]
CF.out -> AGND.in #slate [ortho]
FC.node -> CONV.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=migrate; eyebrow=02 / Migration; title=Move to 0.8 deliberately; example-title=Decoupled supply rail; example-summary=One regulator output, three decoupling capacitors, drawn as a single tree. -->

Existing documents keep compiling, and every drawing in the compiler's 261-document corpus is byte-identical to 0.7. Three things are worth knowing before we lean on the release.

**Both new features are opt-in syntax.** `trunk` is a connection option and `subcircuit` is a block; a document that uses neither takes exactly the path it took before. They add two optional fields that only they ever set — `connection.trunk` on the document, and `junction` on a routed trace — so a host with an exhaustive read of either type sees nothing new on old documents.

**Trunks change the drawing, not the circuit.** Every point on a net is the same electrical node, so the netlist, `verifyNetlist`, `describeSchematic` and the source map are identical with or without `trunk`. Which end of a branch joins the net is decided by the declarations above it, so a branch whose terminals are both new, or both already wired, is a compile error with its line.

**The compiler bundle grew to 38 KiB gzip**, about 3.3 KiB more than 0.7. Roughly two-thirds of that is sub-circuit expansion and a third is trunk routing; about a third of each is diagnostic text, which the project does not trade away. A host that counts bytes closely should know before upgrading.

```schemd bounds="820x480" title="Decoupled supply rail"
source:REG "3V3" at (100, 240) #blue [type=voltage-dc]
capacitor:C1 "10 \mu F" at (420, 110) #cyan
capacitor:C2 "100 nF" at (420, 240) #cyan
capacitor:C3 "1 nF" at (420, 370) #cyan

REG.positive -> C1.in #blue [ortho]
REG.positive -> C2.in #blue [ortho trunk]
REG.positive -> C3.in #blue [ortho trunk]
```

The first capacitor is wired the ordinary way. The other two are marked `trunk`, so each leaves the copper the rail already has rather than running back to the regulator — the tree a draughtsman would draw, with a dot at every junction so a reader can tell a join from a crossing.

<!-- /schemd-section -->

<!-- schemd-section: id=limitations; eyebrow=03 / Boundaries; title=Read this before trusting a clean compile; example-title=Two nets, one crossing; example-summary=Separate nets bridge at a crossing; one net stays continuous. -->

A document that compiles is a drawing the compiler could place and route. It is not a claim that the circuit works. The failure mode of a tool like this is a confident picture of something wrong, so here is where the confidence stops.

- **`verifyNetlist` is structural linting, not verification.** It runs deterministic rules over a flat connectivity model. It establishes nothing about analog correctness, timing, impedance, drive strength, metastability, quantum validity, or behaviour. A clean result means no rule fired.
- **Routing is greedy, then retried, then bundled — and still bounded.** Each trace is placed against the ones already laid, so the first pass is order-dependent. When one cannot be placed the router tears up what it has laid and retries, which carries a full reversal bus to twelve wires; when the retry budget is spent it lays the bundle out as a set instead, which reaches thirty-two. A document that needs that last path says so in `routing.nudged`. None of this is a general router: past what the channel model holds, a route can still be rejected because of a choice made earlier rather than because no arrangement exists.
- **The model is flat underneath.** Sub-circuits are expanded into ordinary parts before anything else reads the document, so the netlist, the SVG and the decompiler all see the flattened drawing. There are no sub-sheets, no ports between pages, no simulation, and no standards conformance. That suits documentation, teaching, and schematics-as-source — not large engineering designs.
- **A trunk is a good tree, not the best one.** Each branch joins the nearest copper its net already has, in declaration order, so the tree is the sequential approximation to a rectilinear Steiner tree rather than the shortest possible one.
- **Descriptions report connectivity, not intent.** `describeSchematic` states what the netlist proves and deliberately names no archetype, because a confident wrong label is worse for a screen-reader user than an accurate structural one.
- **Published performance figures are narrow.** Warm medians on one Apple Silicon and Node configuration. Run `bun run benchmark` on our own hardware.

```schemd bounds="880x360" title="Two nets, one crossing"
port:TX "TXD" at (90, 180) #amber
port:TXO "TXD'" at (770, 180) #amber
port:RX "RXD" at (430, 70) #violet [orientation=down]
port:RXO "RXD'" at (430, 290) #violet [orientation=down]

TX.out -> TXO.in #amber [ortho net=UART_TX]
RX.out -> RXO.in #violet [ortho net=UART_RX]
```

Those two traces must cross, and they belong to different nets — so the compiler draws a bridge rather than a junction. Had they carried the same `net=`, the crossing would have stayed continuous, because then it would be one conductor.

<!-- /schemd-section -->
