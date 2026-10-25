<!-- schemd-doc: id=limits; label=Resource budgets; title=Compile source you did not write; summary=Set a per-compilation budget so an oversized document is rejected at the declaration that crosses it, not after it is routed.; category=Operate safely; order=95 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate budgets, not connectivity. -->

A document may declare as many components and connections as it can place. Version 0.4 removed the ceilings of 512 components and 2,048 connections. The compiler is linear in both, and sixty-four thousand components compile in about a second.

That default suits source under the host's control. It is the wrong default for source from elsewhere, such as a Markdown fence in a comment or a field in a CMS. Such source should be compiled with a budget.

<!-- schemd-section: id=budget; eyebrow=01 / Budgets; title=Reject an oversized document before routing it; example-title=A small figure inside a tight budget -->

```ts
compileSchematic(source, {
	...fence,
	limits: { components: 400, connections: 1_500, sourceCharacters: 64_000 }
});
// SchematicSyntaxError: Line 401: Schematic exceeds the 400 component limit.
```

The rejection happens during parsing, at the declaration that crosses the ceiling. No geometry has been checked by then, no wire routed and no markup generated. That is the purpose of a budget: it makes refusal cheap.

```schemd bounds="720x300" title="A small figure inside a tight budget"
port:SW "switch" at (80, 150) #blue
resistor:RPU "47 k\Omega" at (300, 150) #amber
port:PIN "MCU pin" at (620, 150) #emerald

SW.out -> RPU.in #blue [ortho]
RPU.out -> PIN.in #emerald [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=fields; eyebrow=02 / Fields; title=Every field is optional; example-title=A bounded corridor -->

Every field is optional, and an omitted field keeps its default. Passing nothing therefore compiles exactly as it did before the option existed. `sourceCharacters` also bounds what [sub-circuits](/docs/1.2/subcircuits) expand to. An instance is shorthand for the declarations it stands for, and nested instances could otherwise turn a short document into an unbounded one. `Infinity` states no limit explicitly, and the two counts default to it.

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

```schemd bounds="800x370" title="A bounded corridor"
port:PL "P" at (70, 110) #blue
inductor:LZ "L" at (330, 110) #purple [orientation=down]
component:SHD "shield can" at (330, 260) #slate [width=160 height=70]
port:QL "Q" at (700, 110) #emerald

PL.out -> LZ.in #blue [ortho]
LZ.out -> QL.in #emerald [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=contract; eyebrow=03 / Contract; title=What the compiler guarantees about a budget; example-title=Two nets on one sheet -->

A budget is resolved once per compilation and handed to both the parser and the renderer. An accessor cannot give one pass a generous value and the other a strict one, which would leave the document checked against neither.

A budget is not clamped to the defaults. A host that raises `svgOutputBytes` has decided it can afford the allocation, and the compiler accepts that decision.

A misspelt field is an error. `limits: { component: 4 }` throws `Unknown compiler limit component.` A limit that a host believes it set, and did not, is worse than no limit at all.

`SCHEMATIC_LIMITS` reports the defaults. Its two unlimited counts are `Infinity`, which `JSON.stringify` renders as `null`, so an API that exposes them needs a replacer.

```schemd bounds="780x370" title="Two nets on one sheet"
port:LT "left" at (90, 170) #emerald
port:RT "right" at (670, 170) #emerald
port:BT "bottom" at (390, 290) #rose [orientation=up]
port:TP "top" at (390, 80) #rose [orientation=down]

LT.out -> RT.in #emerald [ortho net=SUPPLY]
TP.out -> BT.out #rose [ortho net=DATA]
```

<!-- /schemd-section -->

<!-- schemd-section: id=timeout; eyebrow=04 / Time; title=A budget is not a timeout; example-title=Little source, real routing work -->

Every field above bounds a size, and none of them bounds time. A small document can still be expensive to route. Each net is a lattice search, and the work of that search comes from congestion, where nets compete for the same channels. The count of declarations has little to do with it.

A budget should therefore be paired with a time limit that the host enforces: a worker with a deadline, an `AbortSignal` around the call site, or a queue with a ceiling per job. `wireCrossings` bounds the crossing pass in particular. It is the closest thing to a work limit the compiler offers, though it does not replace a timeout.

```schemd bounds="740x330" title="Little source, real routing work"
port:IA "A" at (80, 110) #blue
port:OA "A'" at (640, 250) #blue
port:IB "B" at (80, 250) #amber
port:OB "B'" at (640, 110) #amber

IA.out -> OA.in #blue [ortho]
IB.out -> OB.in #amber [ortho]
```

<!-- /schemd-section -->
