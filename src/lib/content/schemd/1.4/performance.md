<!-- schemd-doc: id=performance; label=Performance; title=Measure scaling and bound every host; summary=Separate compiler throughput, bundle cost, response amplification, and the limits a public service must add.; category=Operate safely; order=100 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples measure geometry throughput, not connectivity. -->

<!-- schemd-section: id=budgets; eyebrow=01 / Compiler; title=Read scaling and size as separate budgets; example-title=A bounded route around a bracket -->

Since 0.4 there is no default count of components or connections. That is a capability of the compiler, and it gives no public endpoint permission to accept arbitrary work. The two are easy to confuse, and confusing them is expensive. Whenever the source comes from elsewhere, `components`, `connections`, `sourceCharacters`, `wireCrossings` and `svgOutputBytes` should be set through the per-compilation [`limits`](/docs/1.4/limits) option.

A wall-clock deadline is still required on top of that. Every one of those fields bounds a size, and none of them bounds time. A small document with awkward geometry can be expensive to route, and no count of output bytes will catch it.

```schemd bounds="800x360" title="A bounded route around a bracket"
port:PI "P" at (70, 100) #purple
inductor:LI "L" at (330, 100) #purple [orientation=down]
component:BRK "bracket" at (330, 250) #slate [width=150 height=70]
port:QI "Q" at (700, 100) #emerald

PI.out -> LI.in #violet [ortho]
LI.out -> QI.in #emerald [ortho]
```

The release gate measures two client costs, each in gzip and in brotli-11. A host that imports only `compileSchematic` and tree-shakes the rest must stay below 46 KiB gzip and 40 KiB brotli. The complete public entry, which includes exports a given host may never call, must stay below 49 KiB gzip and 42.5 KiB brotli. 1.4.0 measures 46,395 bytes and 49,493 bytes gzip — absorbing measured sheets (`bounds="auto"`) and draft placement while cutting the shipped `dist/` directory by over 53% compared to unminified `tsc` output (209,354 bytes total). Both figures are budgets for the bundled code. They say nothing about the size of the TypeScript declarations, the npm tarball, the installed files or a website route. `bun run size` on the exact release commit gives the real measurement, and a registry screenshot does not.

1.3 added the component schema as a separate entry, `@schemd/core/schema`, which started at 16,465 bytes gzip in 1.3.0 because `describeComponentPorts` pulled in the symbol registry. In 1.4.0 `describeComponentPorts` derives canonical ports and validates options standalone, cutting `@schemd/core/schema` by 75.5% to 4,059 bytes gzip (3,631 bytes brotli-11), under a tightened 4.5 KiB gzip budget, and a host that only compiles never loads it. Before that, optional labels cost 35 bytes on the compile path in 1.2, which fitted inside the budgets 1.1 set. 1.1 had added 1.8 KiB: about 1.4 KiB of code for [fitting](/docs/1.4/fit), terminal alignment and two layout fixes, and 0.4 KiB for the seven diagnostics that say which terminal cannot line up and which height would let it. `fit` is an option that every kind's parser reads, so it cannot be tree-shaken out.

Before that, 1.0 grew the compile path by about 4.5 KiB over 0.8, and the reason deserves a plain statement. The rebuild deleted the old router with its reordering and rip-up rescue, bundle nudging, and the parallel switches per kind. The space went to routing by net with negotiated congestion, a spatial index that keeps compilation linear, exact integer geometry, measured text, and the diagnostics model behind `diagnoseSchematic`. The routing stack holds most of the bytes, and it is code, which compresses worse than the templates it replaced. One lever remains, moving the diagnostic prose behind codes, and this project does not use it. A diagnostic that does not say how to fix the diagram is itself the defect.

Scaling is gated separately, and compilation stays linear. A uniform-grid index over obstacles, wires and labels means that a search reads only its own window, and 10,000 components compile in well under a quarter of a second.

On the machine that wrote this page, 1.4.0 compiles a contended twelve-wire reversal bus in 0.87 ms (down from 1.68 ms in 1.3.1, −48% to −53%). Dense 16×16 routing drops from 16.15 ms to 3.19 ms (−80%), a 512-component sheet drops from 3.11 ms to 1.13 ms (−64%), and a simple document compiles in 0.24 ms cold and 0.11 ms warm (down from 0.34 ms). Every document that declares its bounds and positions remains byte-for-byte identical to 1.3.1.

These are warm medians from one machine. The lasting claim is the guarded slope, and the absolute millisecond values are not. `bun run benchmark` gives the figures for other hardware, and it should be run before any of them is quoted.

<!-- /schemd-section -->

<!-- schemd-section: id=server-cache; eyebrow=02 / Host; title=Isolate deadlines and cap amplification; example-title=Cache-key reference -->

The official compile endpoint applies limits stricter than the library defaults. It rejects oversized request bodies before any JSON is allocated, limits the request rate per client, and runs each compilation outside the request thread. A deadline can terminate that worker, whereas `Promise.race` around a synchronous compilation cannot. Concurrency and queue depth are finite, and a full queue returns a capacity error that may be retried, so memory never multiplies by the burst the rate limit allows.

```schemd bounds="720x300" title="Cache-key reference"
clock:CKV "CLK" at (90, 120) #emerald
flipflop:FJ "JK" at (340, 120) #cyan [type=jk]
port:QV "Q" at (620, 120) #emerald

CKV.out -> FJ.clock #amber [digital ortho]
FJ.q -> QV.in #emerald [digital ortho]
```

Successful compilations and failed ones with line numbers share an LRU cache keyed by SHA-256, capped at 64 entries and 16 MiB. The key covers the mode, bounds, title and source, and a hit refreshes the entry's recency. Registry data uses one immutable snapshot that is revalidated while stale, with a single refresh in flight. The documentation and simulation caches are keyed by finite registries, never by user input.

The browser editor compiles locally, in a native worker that holds `@schemd/core` and starts only when needed. It falls back to the endpoint when the worker is unavailable. Normal typing therefore costs no network round trip and no server work, and the worker boundary lets a deadline stop a pathological local compile. The compiler also stays off the critical paths of the documentation, catalogue and simulation pages. The website's build budget checks both facts from Vite's manifest.

Performance work is not finished when one benchmark turns green. `bun run benchmark` should be repeated on the target hardware, and p95 and p99 under concurrent load matter more than a warm median. The serialized response should be measured as well as parser time before any budget on a public host is raised.

<!-- /schemd-section -->
