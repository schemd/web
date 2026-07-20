<!-- schemd-doc: id=performance; label=Performance; title=Keep compilation bounded and measurable; summary=Use fixed resource ceilings, deterministic caches, and exact output-byte regressions.; category=Operate safely; order=100 -->

<!-- schemd-section: id=budgets; eyebrow=01 / Limits; title=Reject hostile work before allocation; example-title=Bounded rotated route -->

The compiler caps source length, components, connections, wire crossings, UML rows, pins, label lengths, routing states, and SVG output. Orthogonal routing remains bounded even when rotated AABBs create tight corridors.

```schemd bounds="800x360" title="Bounded rotated route"
port:A "A" at (70, 100) #blue
resistor:R "R" at (330, 100) #amber [orientation=down]
component:BLOCK "obstacle" at (330, 250) #slate [width=150 height=70]
port:B "B" at (700, 100) #emerald
A.out -> R.in #blue [ortho]
R.out -> B.in #emerald [ortho]
```

Release-candidate measurements for the complete 0.3 compiler are **90,714 B minified**, **26,398 B gzip**, **59,188 B npm tarball**, and **258,463 B unpacked**. The hard compiler gate is 30,720 B gzip.

<!-- /schemd-section -->

<!-- schemd-section: id=server-cache; eyebrow=02 / Node; title=Bound every process-lifetime cache; example-title=Cache-key reference -->

The website registry stores one immutable release snapshot and one refresh promise. The compile API uses a 256-entry LRU. Documentation and simulation caches are keyed by finite version/slug or environment registries; user source is never accumulated without eviction.

```schemd bounds="720x300" title="Cache-key reference"
clock:C "CLK" at (90, 120) #blue
counter:N "count" at (340, 120) #cyan [outputs=4]
port:Q "Q" at (620, 120) #emerald
C.out -> N.clock #blue [digital ortho]
N.out1 -> Q.in #emerald [digital line]
```

On Node.js 26.4.0 / Apple Silicon, Phase 5 warm medians were 0.202 ms for the representative RC compile, 6.583 ms for 512 rotated components, and 2.982 ms for a dense 16×16 crossing fixture. Their SVG outputs were 6,019 B, 279,243 B, and 44,604 B. A repeated-symbol fixture emitted 1,353 B for one resistor and 35,463 B for 64 labeled mixed-orientation instances.

<!-- /schemd-section -->
