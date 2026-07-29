<!-- schemd-doc: id=performance; label=Performance; title=Measure scaling and bound every host; summary=Separate compiler throughput, bundle cost, response amplification, and the limits a public service must add.; category=Operate safely; order=100 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples measure geometry throughput, not connectivity. -->

<!-- schemd-section: id=budgets; eyebrow=01 / Compiler; title=Read scaling and size as separate budgets; example-title=Bounded rotated route -->

Version 0.4 has no default component or connection count. Note that this is a compiler capability,
not permission for a public endpoint to accept arbitrary work — the two are easy to confuse and
expensive to confuse. Whenever the source is not ours, set `components`, `connections`,
`sourceCharacters`, `wireCrossings`, and `svgOutputBytes` through the per-compilation
[`limits`](/docs/0.4/limits) option.

A wall-clock deadline is still required on top of that, because every one of those fields bounds a
_size_ and none of them bounds _time_. A small document with pathological geometry can be expensive
to route, and no count of output bytes will catch it.

```schemd bounds="800x360" title="Bounded rotated route"
port:A "A" at (70, 100) #blue
resistor:R "R" at (330, 100) #amber [orientation=down]
component:BLOCK "obstacle" at (330, 250) #slate [width=150 height=70]
port:B "B" at (700, 100) #emerald
A.out -> R.in #blue [ortho]
R.out -> B.in #emerald [ortho]
```

The release gate measures two different client costs. A tree-shaken host that imports only
`compileSchematic` must remain below **32 KiB gzip**; the complete public entry, which includes
exports a given host may never call, must remain below **35 KiB gzip**. Both are budgets, not claims
that TypeScript declarations, the npm tarball, installed files, or a website route have the same
size. Run `bun run size` on the exact release commit instead of repeating a registry screenshot as a
bundle measurement.

Scaling is gated independently. The 0.4 candidate measured 64,000 components with 32,000 connections
at roughly one second and a flat cost near 16 µs per component from 8,000 upward; 11,200 components
with 800 obstacle-dodging orthogonal traces measured about 130 ms. Those are warm figures from one
Apple Silicon/Node configuration. The durable claim is the guarded slope, not the absolute
millisecond value.

<!-- /schemd-section -->

<!-- schemd-section: id=server-cache; eyebrow=02 / Host; title=Isolate deadlines and cap amplification; example-title=Cache-key reference -->

The official compile endpoint applies limits stricter than the library defaults, rejects oversized
request bodies before JSON allocation, rate-limits by client, and runs a compilation outside the
request thread. A deadline can terminate that worker; `Promise.race` around synchronous compilation
cannot. Concurrency and queue depth are finite, and a full queue returns a retryable capacity error
instead of multiplying memory by the rate-limit burst.

```schemd bounds="720x300" title="Cache-key reference"
clock:C "CLK" at (90, 120) #blue
counter:N "count" at (340, 120) #cyan [outputs=4]
port:Q "Q" at (620, 120) #emerald
C.out -> N.clock #blue [digital ortho]
N.out1 -> Q.in #emerald [digital line]
```

Successful and line-numbered failed compilations share a SHA-256-keyed LRU capped at 64 entries and
16 MiB. The cache key includes mode, bounds, title, and source; hits refresh recency. Registry data
uses one immutable stale-while-revalidate snapshot and one in-flight refresh promise. Documentation
and simulation caches are keyed by finite registries rather than user input.

The browser IDE compiles locally in a lazily started native worker containing `@schemd/core` and
uses the endpoint only as a fallback. That removes a network round trip and server work from normal
typing, and the worker boundary lets a deadline terminate a pathological local compile, without
putting the compiler on documentation, catalogue, or simulation critical paths. The website build
budget verifies both facts from Vite’s manifest.

Performance work is not finished when one benchmark turns green. Re-run `bun run benchmark` on the
target hardware, read p95 and p99 under concurrent load rather than a warm median, and measure the
serialized response — not only parser time — before raising any public-host budget.

<!-- /schemd-section -->
