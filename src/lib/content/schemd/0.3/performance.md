<!-- schemd-doc: id=performance; label=Performance; title=Keep compilation bounded and measurable; summary=Use fixed resource ceilings, deterministic caches, and exact output-byte regressions.; category=Operate safely; order=100 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples measure geometry throughput, not connectivity. -->

<!-- schemd-section: id=budgets; eyebrow=01 / Limits; title=Reject hostile work before allocation; example-title=Bounded rotated route -->

In 0.3 the ceilings are fixed rather than per-compilation: source length, components, connections, wire crossings, UML rows, pins, label lengths, routing states, and SVG output are all capped by the compiler itself. Orthogonal routing stays bounded even when a rotated body leaves a tight corridor — which is exactly the case below.

```schemd bounds="860x380" title="Bounded corridor around a keep-out"
port:IN "in" at (80, 110) #blue
capacitor:CB "C" at (330, 110) #cyan [orientation=up]
component:BODY "keep-out" at (330, 270) #slate [width=170 height=80]
port:OUT "out" at (740, 110) #emerald

IN.out -> CB.in #blue [ortho]
CB.out -> OUT.in #emerald [ortho]
```

Two budgets are enforced, because there are two honest answers to how big schemd is. Tree-shaken to `compileSchematic` — what a host that only compiles actually ships — the 0.3.6 release measures **103,084 B minified** and **30,806 B gzip** against a 31,744 B gate. The whole public entry with nothing shaken away, which is what registry size tools report because they bundle every export, measures **110,542 B minified** and **33,572 B gzip** against a 34,816 B gate. On disk that is a **77,670 B npm tarball** and **330,916 B unpacked**. Both gates run in `bun run size`.

Neither gzip figure moved in 0.3.6 even though the release adds a module: `@schemd/core/describe` sits outside the package entry, so nothing that only compiles can reach it. The tarball grew by the two files it ships.

Tracking only the first figure is how the published number moved 1.8 KB in 0.3.4 with nothing noticing.

<!-- /schemd-section -->

<!-- schemd-section: id=server-cache; eyebrow=02 / Node; title=Bound every process-lifetime cache; example-title=Cache-key reference -->

The website registry stores one immutable release snapshot and one refresh promise. The compile API uses a 256-entry LRU. Documentation and simulation caches are keyed by finite version/slug or environment registries; user source is never accumulated without eviction.

```schemd bounds="760x310" title="Cache-key reference"
clock:CK "CLK" at (100, 130) #blue
encoder:EN "encode" at (350, 130) #cyan [inputs=4 outputs=2]
port:CODE "code" at (630, 130) #emerald

CK.out -> EN.in1 #blue [digital ortho]
EN.out1 -> CODE.in #emerald [digital line]
```

On Node.js 26.4.0 / Apple Silicon, Phase 5 warm medians were 0.202 ms for the representative RC compile, 6.583 ms for 512 rotated components, and 2.982 ms for a dense 16×16 crossing fixture. Their SVG outputs were 6,019 B, 279,243 B, and 44,604 B. A repeated-symbol fixture emitted 1,353 B for one resistor and 35,463 B for 64 labeled mixed-orientation instances.

Absolute milliseconds belong to the machine that measured them, so read the ratios. Routing cost in 0.3.5 falls to **0.53×** on the dense crossing fixture and **0.40×** on a 512-component chain that wires one connection per component. The gap between those two is the point: the old obstacle index was keyed on x alone, so a column held every obstacle stacked along it and cost grew with the document's height rather than with what a segment could actually hit. Documents whose connection count grows with their component count gained most; a sparse document was already cheap and is unchanged. Run `bun run benchmark` to get the numbers for your own hardware.

<!-- /schemd-section -->
