<!-- schemd-doc: id=limits; label=Resource budgets; title=Compile source you did not write; summary=Set a per-compilation budget so an oversized document is rejected at the declaration that crosses it, not after it is routed.; category=Operate safely; order=95 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate budgets, not connectivity. -->

A document may declare as many components and connections as it can place. Version 0.4 removed the 512-component and 2,048-connection ceilings entirely: the compiler is linear in both, and sixty-four thousand components compile in about a second.

That is the right default for source you control. It is the wrong default for source you do not — a Markdown fence from a comment, a pull request, a CMS field. For those, pass a budget.

<!-- schemd-section: id=budget; eyebrow=01 / Budgets; title=Reject an oversized document before routing it; example-title=A modest diagram inside a tight budget -->

```ts
compileSchematic(source, {
	...fence,
	limits: { components: 400, connections: 1_500, sourceCharacters: 64_000 }
});
// SchematicSyntaxError: Line 401: Schematic exceeds the 400 component limit.
```

The rejection happens at the declaration that crosses the ceiling, during parsing — before any geometry is validated, any wire is routed, or any markup is generated. That is the whole point: refusing cheaply is what a budget buys you.

```schemd bounds="720x300" title="A modest diagram inside a tight budget"
port:RSTIN "rst" at (80, 150) #blue
resistor:RB "47 k\Omega" at (300, 150) #amber
port:RSTOUT "out" at (620, 150) #emerald

RSTIN.out -> RB.in #blue [ortho]
RB.out -> RSTOUT.in #emerald [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=fields; eyebrow=02 / Fields; title=Every field is optional; example-title=Bounded orthogonal corridor -->

Every field is optional and every omitted field keeps its default, so passing nothing compiles exactly as it did before the option existed. `Infinity` states no limit explicitly, which is what the two counts default to.

| Field              | Default     | Bounds                                           |
| ------------------ | ----------- | ------------------------------------------------ |
| `components`       | unlimited   | component declarations                           |
| `connections`      | unlimited   | directed connections                             |
| `sourceCharacters` | 16,777,216  | UTF-16 characters read in one pass               |
| `wireCrossings`    | 32,768      | orthogonal intersections before routing gives up |
| `svgOutputBytes`   | 268,435,456 | UTF-8 bytes of generated markup                  |
| `placementDepth`   | 64          | longest chain of relative placements             |
| `routingAttempts`  | 12          | routing passes before contention is fatal        |

`routingAttempts` is the one budget whose cost lands on documents that _fail_. A diagram that routes cleanly never enters the retry loop and pays nothing for it; one that cannot be routed pays for every attempt before the diagnostic arrives. Keep it low for source we did not write, or set it to `1` to turn retries off.

The defaults that remain bound allocation, not diagram size. They sit far past any readable drawing, so treat them as a backstop against a runaway input rather than as a policy you have chosen.

```schemd bounds="800x360" title="Bounded orthogonal corridor"
port:PL "P" at (70, 100) #blue
inductor:LB "L" at (330, 100) #cyan [orientation=down]
component:CAGE "screen can" at (330, 250) #slate [width=150 height=70]
port:QL "Q" at (700, 100) #emerald

PL.out -> LB.in #blue [ortho]
LB.out -> QL.in #emerald [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=contract; eyebrow=03 / Contract; title=What the compiler guarantees about a budget; example-title=Two nets, one canvas -->

**A budget is resolved once per compilation** and handed to both the parser and the renderer. An accessor cannot be generous to one pass and mean to the other, which would validate a document against neither.

**A budget is not clamped to the defaults.** A host that raises `svgOutputBytes` has decided it can afford the allocation; the compiler does not second-guess that.

**A misspelled field is an error, not a no-op.** `limits: { component: 4 }` throws `Unknown compiler limit component.` rather than silently doing nothing — a limit you believe you set and did not is worse than no limit at all.

**`SCHEMATIC_LIMITS` reports the defaults.** Its two unlimited counts are `Infinity`, which `JSON.stringify` renders as `null`; pass a replacer if you expose them over an API.

```schemd bounds="760x340" title="Two nets, one canvas"
port:WL "W" at (80, 110) #amber
port:EL "E" at (660, 110) #amber
port:SL "S" at (370, 230) #purple [orientation=up]
port:NL "N" at (370, 80) #purple [orientation=down]

WL.out -> EL.in #amber [ortho net=DATA]
NL.out -> SL.in #purple [ortho net=LATCH]
```

<!-- /schemd-section -->

<!-- schemd-section: id=timeout; eyebrow=04 / Time; title=A budget is not a timeout; example-title=Small source, real routing work -->

Every field above bounds a _size_. None of them bounds _time_. A small document can still be expensive to route: orthogonal routing falls back to a sparse compressed-grid search, and congestion is what makes that search work, not declaration count.

Pair a budget with a time limit you enforce yourself — a worker with a deadline, an `AbortSignal` around the call site, a queue with a per-job ceiling. `wireCrossings` bounds the crossing pass specifically and is the closest thing to a work limit the compiler offers, but it is not a substitute.

```schemd bounds="720x320" title="Small source, real routing work"
port:A1 "A" at (80, 90) #cyan
port:B1 "B" at (620, 230) #cyan
port:A2 "A" at (80, 230) #purple
port:B2 "B" at (620, 90) #purple

A1.out -> B1.in #cyan [ortho]
A2.out -> B2.in #purple [ortho]
```

<!-- /schemd-section -->
