<!-- schemd-doc: id=performance; label=Performance; title=Measure scaling and bound every host; summary=Separate compiler throughput, bundle cost, response amplification, and the limits a public service must add.; category=Operate safely; order=100 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples measure geometry throughput, not connectivity. -->

<!-- schemd-section: id=budgets; eyebrow=01 / Compiler; title=Read scaling and size as separate budgets; example-title=Bounded rotated route -->

Since 0.4 there is no default component or connection count. Note that this is a compiler capability, not permission for a public endpoint to accept arbitrary work — the two are easy to confuse and expensive to confuse. Whenever the source is not ours, set `components`, `connections`, `sourceCharacters`, `wireCrossings`, and `svgOutputBytes` through the per-compilation [`limits`](/docs/1.1/limits) option.

A wall-clock deadline is still required on top of that, because every one of those fields bounds a _size_ and none of them bounds _time_. A small document with pathological geometry can be expensive to route, and no count of output bytes will catch it.

```schemd bounds="800x360" title="Bounded rotated route"
port:PM "P" at (70, 100) #violet
inductor:LM "L" at (330, 100) #purple [orientation=down]
component:CASE "case" at (330, 250) #slate [width=150 height=70]
port:QM "Q" at (700, 100) #emerald

PM.out -> LM.in #violet [ortho]
LM.out -> QM.in #emerald [ortho]
```

The release gate measures two client costs, each in gzip and brotli-11. A tree-shaken host that imports only `compileSchematic` must stay below **44 KiB gzip** and 38.5 KiB brotli; the complete public entry, which includes exports a given host may never call, below **47 KiB gzip** and 41 KiB brotli. 1.1 measures about 43.6 KiB and 46.6 KiB gzip. Both are budgets, not claims that TypeScript declarations, the npm tarball, installed files, or a website route have the same size. Run `bun run size` on the exact release commit instead of repeating a registry screenshot as a bundle measurement.

1.1 adds 1.8 KiB to the compile path: about 1.4 KiB of code for [fitting](/docs/1.1/fit), terminal alignment and two layout fixes, and 0.4 KiB for the seven diagnostics that say which terminal cannot line up and the height that would let it. `fit` is an option every kind's parser reads, so it cannot tree-shake out. Before that, 1.0 grew the compile path about 4.5 KiB over 0.8, and it is worth being explicit about why rather than quietly restating a number. The rebuild deleted the old router, its reorder and rip-up rescue, bundle nudging, and the parallel per-kind switches, and paid for routing by net with negotiated congestion, a spatial index that keeps compilation linear, exact integer geometry, measured text, and the diagnostics model behind `diagnoseSchematic`. The routing stack is where the bytes are, and it is code, which compresses worse than the templates it replaced. The one lever left — moving diagnostic prose behind codes — is not one this project takes, because a diagnostic that does not say how to fix the diagram is the defect.

Scaling is gated independently, and compilation stays linear: a uniform-grid index over obstacles, wires and labels means a search reads only its own window, and 10,000 components compile in about 0.27 s.

1.1 leaves the medians where 1.0 put them; a document with no fitted part skips the fitting pass after one filter. On the machine that wrote this, a contended twelve-wire reversal bus compiles in **1.42 ms** — 16.6 ms in 0.8, before 1.0 began routing it in the first pass, because the search bound counts the bends a pin's facing makes unavoidable. Dense 16×16 routing takes **14.9 ms**, against 4.1 in 0.8, because every one of its 32 targets sits behind a tightly packed column of parts and wrapping each one with clearance is real work on a finer lattice. A simple document costs about 0.33 ms.

Those are warm medians from one machine, and the durable claim is the guarded slope rather than the absolute millisecond value. Run `bun run benchmark` on our own hardware before quoting any of them.

<!-- /schemd-section -->

<!-- schemd-section: id=server-cache; eyebrow=02 / Host; title=Isolate deadlines and cap amplification; example-title=Cache-key reference -->

The official compile endpoint applies limits stricter than the library defaults, rejects oversized
request bodies before JSON allocation, rate-limits by client, and runs a compilation outside the
request thread. A deadline can terminate that worker; `Promise.race` around synchronous compilation
cannot. Concurrency and queue depth are finite, and a full queue returns a retryable capacity error
instead of multiplying memory by the rate-limit burst.

```schemd bounds="720x300" title="Cache-key reference"
clock:CKT "CLK" at (90, 120) #amber
flipflop:FTT "FF" at (340, 120) #cyan [type=t]
port:QTT "Q" at (620, 120) #emerald

CKT.out -> FTT.clock #amber [digital ortho]
FTT.q -> QTT.in #emerald [digital ortho]
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
