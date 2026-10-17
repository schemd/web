<!-- schemd-doc: id=performance; label=Performance; title=Measure scaling and bound every host; summary=Separate compiler throughput, bundle cost, response amplification, and the limits a public service must add.; category=Operate safely; order=100 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples measure geometry throughput, not connectivity. -->

<!-- schemd-section: id=budgets; eyebrow=01 / Compiler; title=Read scaling and size as separate budgets; example-title=Bounded rotated route -->

Since 0.4 there is no default component or connection count. Note that this is a compiler capability,
not permission for a public endpoint to accept arbitrary work — the two are easy to confuse and
expensive to confuse. Whenever the source is not ours, set `components`, `connections`,
`sourceCharacters`, `wireCrossings`, and `svgOutputBytes` through the per-compilation
[`limits`](/docs/0.8/limits) option.

A wall-clock deadline is still required on top of that, because every one of those fields bounds a
_size_ and none of them bounds _time_. A small document with pathological geometry can be expensive
to route, and no count of output bytes will catch it.

```schemd bounds="800x360" title="Bounded rotated route"
port:PM "A" at (70, 100) #violet
inductor:LM "L" at (330, 100) #cyan [orientation=down]
component:CAN "can" at (330, 250) #slate [width=150 height=70]
port:QM "B" at (700, 100) #emerald

PM.out -> LM.in #violet [ortho]
LM.out -> QM.in #emerald [ortho]
```

The release gate measures two different client costs. A tree-shaken host that imports only
`compileSchematic` must remain below **38 KiB gzip**; the complete public entry, which includes
exports a given host may never call, must remain below **41 KiB gzip**. Both are budgets, not claims
that TypeScript declarations, the npm tarball, installed files, or a website route have the same
size. Run `bun run size` on the exact release commit instead of repeating a registry screenshot as a
bundle measurement.

The compiler budget rose from 35 KiB to 38 KiB in 0.8, and from 34 KiB in 0.7 before that, and it is
worth being explicit about why rather than quietly restating a number. In 0.8 the edge-price cache
cost 127 B, trunk branches about 1,150 B and sub-circuits about 2,100 B — roughly a third of each of
those last two is diagnostic text that says how to fix a mistake, measured by stubbing it out and not
traded away. Both features are syntax, so neither can tree-shake out of a host that parses.

In 0.7, similarly, bundle nudging cannot tree-shake out of the compile path — the router
reaches it, so every document that routes carries it — and it is what takes a reversal bus from
twelve wires to thirty-two. The cost is recorded against the capability that bought it, in the same
terms 0.5 used when relative placement moved the budget from 32. Four separate attempts to buy the
bytes back are recorded in the changelog: packed encodings, glyph tables, literal hoisting and
family partitioning each made the _gzipped_ bundle larger or returned far less than projected,
because gzip has already done that job better than a hand-packed encoding can. On this package,
optimising for minified size is optimising against the metric that ships.

Scaling is gated independently. The 0.4 release measured 64,000 components with 32,000 connections
at roughly one second and a flat cost near 16 µs per component from 8,000 upward; 11,200 components
with 800 obstacle-dodging orthogonal traces measured about 130 ms.

0.7 moved the benchmark medians rather than the slope. A 512-component figure compiles in **2.69 ms**
and dense 16×16 orthogonal routing in **4.18 ms**, both from a run where the family predicates stopped
answering by linear scan — four of them ran `KINDS.includes(kind)`, and the _false_ answer is the
expensive one, so every electrical component walked all forty-seven UML keywords before being told
no. A twelve-wire contended bus compiles in **25.2 ms**, from a spatial-bucket query that no longer
allocates an empty array on a miss in the innermost of three nested loops.

0.8 moved the routing-heavy medians. The sparse search used to price every grid edge from both of
its cells and once per arrival direction — two spatial-hash queries each time, which a profile of a
contended bus put at more than half of compile time. It now prices each edge once per route, with
byte-identical output: a twelve-wire contended bus compiles in **18.6 ms** from 27.9, and a
thirty-two-wire bus in about 61 ms from 83. Documents that never reach the sparse search — the
512-component figure and dense 16×16 routing among them — are unchanged.

Those are warm medians from one Apple Silicon/Node configuration, and the durable claim is the
guarded slope rather than the absolute millisecond value. Run `bun run benchmark` on our own
hardware before quoting any of them.

<!-- /schemd-section -->

<!-- schemd-section: id=server-cache; eyebrow=02 / Host; title=Isolate deadlines and cap amplification; example-title=Cache-key reference -->

The official compile endpoint applies limits stricter than the library defaults, rejects oversized
request bodies before JSON allocation, rate-limits by client, and runs a compilation outside the
request thread. A deadline can terminate that worker; `Promise.race` around synchronous compilation
cannot. Concurrency and queue depth are finite, and a full queue returns a retryable capacity error
instead of multiplying memory by the rate-limit burst.

```schemd bounds="720x300" title="Cache-key reference"
clock:CK "CLK" at (90, 120) #amber
flipflop:FT "FF" at (340, 120) #cyan [type=t]
port:QT "Q" at (620, 120) #emerald

CK.out -> FT.clock #amber [digital ortho]
FT.out1 -> QT.in #emerald [digital line]
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
