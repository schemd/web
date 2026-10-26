<!-- schemd-doc: id=limits; label=Resource budgets; title=Compile source you did not write; summary=Set a per-compilation budget so an oversized document is rejected at the declaration that crosses it, not after it is routed.; category=Operate safely; order=95 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate budgets, not connectivity. -->

A document may declare as many components and connections as it can place. Version 0.4 removed the ceilings of 512 components and 2,048 connections. The compiler is linear in both, and sixty-four thousand components compile in about a second.

That default suits source under the host's control. It is the wrong default for source from elsewhere, such as a Markdown fence in a comment or a field in a CMS. Such source should be compiled with a budget.

<!-- schemd-section: id=budget; eyebrow=01 / Budgets; title=Reject an oversized document before routing it; example-title=A short figure inside a tight budget -->

```ts
compileSchematic(source, {
	...fence,
	limits: { components: 400, connections: 1_500, sourceCharacters: 64_000 }
});
// SchematicSyntaxError: Line 401: Schematic exceeds the 400 component limit.
```

The rejection happens during parsing, at the declaration that crosses the ceiling. No geometry has been checked by then, no wire routed and no markup generated. That is the purpose of a budget: it makes refusal cheap.

```schemd bounds="720x300" title="A short figure inside a tight budget"
port:KEY "key" at (80, 150) #blue
resistor:RS "10 k\Omega" at (300, 150) #amber
port:GPIO "GPIO 4" at (620, 150) #emerald

KEY.out -> RS.in #blue [ortho]
RS.out -> GPIO.in #emerald [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=fields; eyebrow=02 / Fields; title=Every field is optional; example-title=A corridor with a budget -->

Every field is optional, and an omitted field keeps its default. Passing nothing therefore compiles exactly as it did before the option existed. `sourceCharacters` also bounds what [sub-circuits](/docs/1.3/subcircuits) expand to. An instance is shorthand for the declarations it stands for, and nested instances could otherwise turn a short document into an unbounded one. `Infinity` states no limit explicitly, and the two counts default to it.

| Field              | Default     | Bounds                                            |
| ------------------ | ----------- | ------------------------------------------------- |
| `components`       | unlimited   | component declarations                            |
| `connections`      | unlimited   | directed connections                              |
| `sourceCharacters` | 16,777,216  | UTF-16 characters read, and sub-circuit expansion |
| `wireCrossings`    | 32,768      | orthogonal intersections before routing gives up  |
| `svgOutputBytes`   | 268,435,456 | UTF-8 bytes of generated markup                   |
| `placementDepth`   | 64          | longest chain of relative placements              |
| `routingAttempts`  | 12          | negotiation rounds before contention is fatal     |

`routingAttempts` is the one budget whose cost falls on documents that fail. A diagram whose nets route on the first pass never negotiates and pays nothing. A diagram that cannot be routed pays for every round before the diagnostic arrives. For source from elsewhere it should be kept low, or set to `1` to forbid contact outright and never negotiate.

The remaining defaults bound allocation and not the size of the diagram. They sit far beyond any readable drawing, so they act as a backstop against runaway input. A host that wants a policy should set its own values.

```schemd bounds="800x370" title="A corridor with a budget"
port:PIN2 "P" at (70, 110) #blue
capacitor:CK "C" at (330, 110) #cyan [orientation=down]
component:PACK "battery pack" at (330, 260) #slate [width=170 height=70]
port:POUT "Q" at (700, 110) #emerald

PIN2.out -> CK.in #blue [ortho]
CK.out -> POUT.in #emerald [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=contract; eyebrow=03 / Contract; title=What the compiler guarantees about a budget; example-title=Power and sense on one sheet -->

A budget is resolved once per compilation and handed to both the parser and the renderer. An accessor cannot give one pass a generous value and the other a strict one, which would leave the document checked against neither.

A budget is not clamped to the defaults. A host that raises `svgOutputBytes` has decided it can afford the allocation, and the compiler accepts that decision.

A misspelt field is an error. `limits: { component: 4 }` throws `Unknown compiler limit component.` A limit that a host believes it set, and did not, is worse than no limit at all.

`SCHEMATIC_LIMITS` reports the defaults. Its two unlimited counts are `Infinity`, which `JSON.stringify` renders as `null`, so an API that exposes them needs a replacer.

```schemd bounds="780x380" title="Power and sense on one sheet"
port:IN3 "input" at (90, 180) #emerald
port:OUT3 "output" at (670, 180) #emerald
port:PB3 "probe'" at (390, 300) #rose [orientation=up]
port:PT3 "probe" at (390, 80) #rose [orientation=down]

IN3.out -> OUT3.in #emerald [ortho net=POWER]
PT3.out -> PB3.out #rose [ortho net=SENSE]
```

<!-- /schemd-section -->

<!-- schemd-section: id=timeout; eyebrow=04 / Time; title=A budget is not a timeout; example-title=Few lines, real routing work -->

Every field above bounds a size, and none of them bounds time. A small document can still be expensive to route. Each net is a lattice search, and the work of that search comes from congestion, where nets compete for the same channels. The count of declarations has little to do with it.

A budget should therefore be paired with a deadline enforced outside the compilation worker. Run the synchronous compiler in a worker that the host can terminate when time expires. An `AbortSignal` or `Promise.race` around a call on the same thread cannot interrupt it. A queue can limit waiting time, but running work still needs a terminable worker. `wireCrossings` bounds the crossing pass in particular. It is the closest thing to a work limit the compiler offers, though it does not replace a timeout.

```schemd bounds="740x330" title="Few lines, real routing work"
port:MI "M" at (80, 120) #blue
port:MO "M'" at (640, 260) #blue
port:NI "N" at (80, 260) #amber
port:NO "N'" at (640, 120) #amber

MI.out -> MO.in #blue [ortho]
NI.out -> NO.in #amber [ortho]
```

<!-- /schemd-section -->
