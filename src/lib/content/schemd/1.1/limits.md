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
port:BTN "button" at (80, 150) #blue
resistor:RDB "10 k\Omega" at (300, 150) #amber
port:GPIO "GPIO" at (620, 150) #emerald

BTN.out -> RDB.in #blue [ortho]
RDB.out -> GPIO.in #emerald [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=fields; eyebrow=02 / Fields; title=Every field is optional; example-title=Bounded orthogonal corridor -->

Every field is optional and every omitted field keeps its default, so passing nothing compiles exactly as it did before the option existed. `sourceCharacters` also bounds what [sub-circuits](/docs/1.1/subcircuits) expand to: an instance is shorthand for the declarations it stands for, and nested instances would otherwise turn a short document into an unbounded one. `Infinity` states no limit explicitly, which is what the two counts default to.

| Field              | Default     | Bounds                                            |
| ------------------ | ----------- | ------------------------------------------------- |
| `components`       | unlimited   | component declarations                            |
| `connections`      | unlimited   | directed connections                              |
| `sourceCharacters` | 16,777,216  | UTF-16 characters read, and sub-circuit expansion |
| `wireCrossings`    | 32,768      | orthogonal intersections before routing gives up  |
| `svgOutputBytes`   | 268,435,456 | UTF-8 bytes of generated markup                   |
| `placementDepth`   | 64          | longest chain of relative placements              |
| `routingAttempts`  | 12          | negotiation rounds before contention is fatal     |

`routingAttempts` is the one budget whose cost lands on documents that _fail_. A diagram whose nets route on the first pass never negotiates and pays nothing for it; one that cannot be routed pays for every round before the diagnostic arrives. Keep it low for source we did not write, or set it to `1` to forbid contact outright and never negotiate.

The defaults that remain bound allocation, not diagram size. They sit far past any readable drawing, so treat them as a backstop against a runaway input rather than as a policy you have chosen.

```schemd bounds="800x360" title="Bounded orthogonal corridor"
port:PZ "P" at (70, 100) #blue
capacitor:CZ "C" at (330, 100) #cyan [orientation=down]
component:BOX "enclosure" at (330, 250) #slate [width=150 height=70]
port:QZ "Q" at (700, 100) #emerald

PZ.out -> CZ.in #blue [ortho]
CZ.out -> QZ.in #emerald [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=contract; eyebrow=03 / Contract; title=What the compiler guarantees about a budget; example-title=Two nets, one sheet -->

**A budget is resolved once per compilation** and handed to both the parser and the renderer. An accessor cannot be generous to one pass and mean to the other, which would validate a document against neither.

**A budget is not clamped to the defaults.** A host that raises `svgOutputBytes` has decided it can afford the allocation; the compiler does not second-guess that.

**A misspelled field is an error, not a no-op.** `limits: { component: 4 }` throws `Unknown compiler limit component.` rather than silently doing nothing — a limit you believe you set and did not is worse than no limit at all.

**`SCHEMATIC_LIMITS` reports the defaults.** Its two unlimited counts are `Infinity`, which `JSON.stringify` renders as `null`; pass a replacer if you expose them over an API.

```schemd bounds="760x360" title="Two nets, one sheet"
port:WX "west" at (80, 160) #emerald
port:EX "east" at (660, 160) #emerald
port:SX "south" at (370, 280) #rose [orientation=up]
port:NX "north" at (370, 75) #rose [orientation=down]

WX.out -> EX.in #emerald [ortho net=POWER]
NX.out -> SX.out #rose [ortho net=SIGNAL]
```

<!-- /schemd-section -->

<!-- schemd-section: id=timeout; eyebrow=04 / Time; title=A budget is not a timeout; example-title=Small source, real routing work -->

Every field above bounds a _size_. None of them bounds _time_. A small document can still be expensive to route: each net is a lattice search, and congestion — nets negotiating for the same channels — is what makes that search work, not declaration count.

Pair a budget with a time limit you enforce yourself — a worker with a deadline, an `AbortSignal` around the call site, a queue with a per-job ceiling. `wireCrossings` bounds the crossing pass specifically and is the closest thing to a work limit the compiler offers, but it is not a substitute.

```schemd bounds="720x320" title="Small source, real routing work"
port:IX "X" at (80, 100) #blue
port:OX "Y" at (620, 240) #blue
port:IY "X" at (80, 240) #amber
port:OY "Y" at (620, 100) #amber

IX.out -> OX.in #blue [ortho]
IY.out -> OY.in #amber [ortho]
```

<!-- /schemd-section -->
