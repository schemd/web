<!-- schemd-doc: id=overview; label=Quickstart; title=Start with schemd 0.4; summary=Compile multi-domain engineering diagrams into deterministic accessible SVG, and inspect the circuit behind them.; category=Get started; order=10 -->

`schemd` is pronounced like _“skemd”_ (`/skɛmd/`). Version 0.4 removes the component and connection ceilings, makes the remaining budgets configurable per compilation, and reports the canonical terminal behind every port alias — all while preserving the two-line language.

<!-- schemd-section: id=install; eyebrow=01 / Install; title=Compile on the server; example-title=Native RC low-pass filter -->

Install the latest release and compile without a DOM, Canvas, `getBBox()`, or browser layout:

```sh
npm i @schemd/core # or bun add @schemd/core or pnpm add @schemd/core or yarn add @schemd/core
```

```ts
import { compileSchematic } from '@schemd/core';

const result = compileSchematic(source, {
	bounds: { width: 760, height: 430 },
	title: 'RC low-pass filter',
	mode: 'full'
});
```

The capacitor below is physically vertical: its vector, semantic ports, outward normals, collision rectangle, and routing corridors all rotate together.

```schemd bounds="760x430" title="Native RC low-pass filter"
source:VIN "V_{in}" at (80, 140) #blue [type=voltage-ac]
resistor:R1 "10 k\Omega" at (250, 140) #amber
junction:OUT "output node" at (420, 140) #cyan
capacitor:C1 "100 nF" at (420, 260) #cyan [orientation=down]
ground:GND "0 V" at (200, 360) #slate
port:LOAD "V_{out}" at (650, 140) #emerald

VIN.positive -> R1.in #blue [ortho]
VIN.negative -> GND.in #slate [ortho]
R1.out -> OUT.node #amber [line]
OUT.node -> C1.in #cyan [ortho]
C1.out -> GND.in #cyan [ortho]
OUT.node -> LOAD.in #emerald [line]
```

<!-- /schemd-section -->

<!-- schemd-section: id=migrate; eyebrow=02 / Migration; title=Move to 0.4 deliberately; example-title=Legacy-compatible source -->

Existing declarations remain valid. Omitted `orientation` is byte-compatible with the canonical right-facing form when a stable `idPrefix` is supplied. New 0.3 and 0.4 syntax must not be copied into historical 0.2.x documents.

- Keep `in`, `out`, `left/l`, and `right/r` aliases where they already existed.
- **Do not treat an accepted alias as emitted identity.** Version 0.4 canonicalizes
  `SchematicEndpoint.port`, source-map terminals, and full-mode wire metadata before topology
  analysis. A UI keyed on `X1.out` must follow the emitted `X1.out1` (or call
  `canonicalPortName`) even though the source spelling still compiles. This is an observable
  compatibility break for overlays and simulation timelines.
- `MAX_SCHEMATIC_COMPONENTS`, `MAX_SCHEMATIC_CONNECTIONS`, and their
  `SCHEMATIC_LIMITS` fields were removed. Set explicit `limits` at untrusted call sites rather than
  importing the retired global ceilings.
- Replace UML-pseudostate junction workarounds with `junction`.
- Replace horizontal shunt workarounds with `[orientation=down]` or `[orientation=up]`.
- Use explicit `[width=N]` for buses and bus-capable ports.

```schemd bounds="660x280" title="Legacy-compatible source"
port:IN "in" at (70, 120) #blue
resistor:R1 "R" at (260, 120) #amber
port:OUT "out" at (540, 120) #emerald
IN.out -> R1.in #blue [line]
R1.out -> OUT.in #emerald [line]
```

Continue with the [grammar](/docs/0.4/grammar), [component API](/docs/0.4/component-reference), [0.4 playground](/playground/0.4.0), and [release timeline](/changelog).

<!-- /schemd-section -->

<!-- schemd-section: id=limitations; eyebrow=03 / Boundaries; title=Read this before trusting a clean compile; example-title=A diagram is not a verification -->

A document that compiles is a drawing the compiler could place and route. It is not a claim that the circuit works. These are the boundaries, stated plainly, because the failure mode of a tool like this is a confident picture of something wrong.

- **`verifyNetlist` is structural linting, not verification.** It runs deterministic rules over a flat connectivity model. It cannot establish analog correctness, timing, impedance, drive strength, metastability, quantum validity, or functional behaviour. A clean result means no rule fired — not that a circuit is correct or safe. The name predates that distinction and is kept for compatibility.
- **Routing is greedy, in source order, and never rips up.** Each trace is placed against the ones already laid and is never moved to make room for a later one, so congestion is order-dependent: a trace can be unroutable because of a choice an earlier one made, not because no arrangement exists. Terminal approaches are reserved before any wire is placed, and a ten-wire reversal fixture compiles; that is a regression case, not a guarantee for arbitrarily large or dense buses. Reordering the declarations, spreading the endpoints, or widening the fence can free a route.
- **The model is flat.** No hierarchy, no sub-sheets, no behavioural simulation, no timing analysis, no analog solving, no standards certification. The compiler is linear in components and connections — sixty-four thousand components compile in about a second — but a flat drawing is still a drawing. This suits documentation, teaching, and schematics rather than large engineering designs.
- **Descriptions report connectivity, not intent.** `describeSchematic` states what the netlist proves and deliberately names no circuit archetypes, because a confident wrong label is worse for a screen-reader user than an accurate structural one. `headline` belongs in an `alt` attribute; `text` grows with the net count, so expose it as a separate long description.
- **Legacy CNOT spellings address different things.** `control` and `target` name gate-marker positions; `in1`/`out1` and `in2`/`out2` are the composable rails. Both are accepted, and mixing the two models produces valid syntax with a topology you did not intend.
- **Coverage numbers describe the source, not the package.** 100% statement, branch, function, and line coverage, a fourteen-mutant kill gate, and six Chromium goldens all exercise the implementation. They said nothing about whether the published tarball could be imported: `@schemd/core/netlist` was unusable from 0.3.4 through 0.3.6 and `@schemd/core/describe` in 0.3.6, because no test crossed the installed-package boundary. A packaging test now does.
- **Published performance figures are narrow.** Warm medians on one Apple Silicon / Node configuration. There are no published cold-start, memory, pathological-input, browser-runtime, or multi-platform results. Run `bun run benchmark` on your own hardware.

Budgets for source you did not write are covered in [resource budgets](/docs/0.4/limits).

<!-- /schemd-section -->
