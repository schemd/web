<!-- schemd-doc: id=roadmap; label=Roadmap; title=Help shape Schemd; summary=Pick a known limit, agree on the approach, and help move the compiler forward.; category=Contribute; order=110 -->

<!-- schemd-section: id=now; eyebrow=01 / Now · P1; title=Build the topology and routing foundation; example-title=Routing foundation; example-summary=Topology and reusable routing come before a larger symbol catalog. -->

These are correctness items, so they come first — everything else is decoration on top of a drawing that has to be _right_ before it is allowed to be pretty.

- [ ] **P1-02 · Net and junction semantics.** Split explicit nets at junctions, render one junction dot, and bridge only separate nets. [Claim P1-02](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P1-02%20%E2%80%94%20Net%20and%20junction%20semantics)
- [ ] **P1-04 · Document-level routing index.** Reuse an interval index or visibility graph instead of rescanning every obstacle. Depends on P1-02. [Claim P1-04](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P1-04%20%E2%80%94%20Document-level%20routing%20index)
- [ ] **P1-03 · Line and Bézier collision rules.** Define manual opt-outs or validate straight and cubic paths against components and crossings. Depends on P1-02. [Claim P1-03](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P1-03%20%E2%80%94%20Line%20and%20Bezier%20collision%20rules)
- [ ] **P1-08 · Component overlap validation.** Reject accidental overlap in `O(V log V)` while allowing explicit semantic containers. [Claim P1-08](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P1-08%20%E2%80%94%20Component%20overlap%20validation)

```schemd bounds="760x320" title="Routing foundation"
port:IN "Input" at (60, 160) #blue
resistor:R1 "10 k\Omega" at (250, 160) #amber
capacitor:C1 "100 nF" at (490, 160) #cyan
port:OUT "Output" at (700, 160) #emerald

IN.out -> R1.in #blue [ortho]
R1.out -> C1.in #amber [ortho]
C1.out -> OUT.in #emerald [ortho marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=next; eyebrow=02 / Next · P1; title=Make every rendered detail deliberate; example-title=Visual precision; example-summary=Markers, typography, routes, and tests must agree. -->

This is the work that turns valid output into _dependable_ output — the distance between "it compiled" and "you would put it in a specification without apologizing for it."

- [ ] **P1-05 · Wire and label occupancy.** Add soft route costs and route around unrelated external labels. Depends on P1-04. [Claim P1-05](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P1-05%20%E2%80%94%20Wire%20and%20label%20occupancy)
- [ ] **P1-06 · Dense bridge clusters.** Preserve a tangent gap, merge close crossings, or report a diagnostic. Depends on P1-02. [Claim P1-06](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P1-06%20%E2%80%94%20Dense%20bridge%20clusters)
- [ ] **P1-07 · Background-independent UML markers.** Trim paths, use transparent interiors, and include marker bounds in collision checks. [Claim P1-07](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P1-07%20%E2%80%94%20Background-independent%20UML%20markers)
- [ ] **P1-09 · Deterministic typography.** Publish the font contract and wrap or reject overflowing UML rows clearly. [Claim P1-09](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P1-09%20%E2%80%94%20Deterministic%20typography)
- [ ] **P1-10 · Visual and adversarial test gates.** Add browser goldens, route properties, bounded fuzzing, and mutation checks. [Claim P1-10](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P1-10%20%E2%80%94%20Visual%20and%20adversarial%20tests)

```schemd bounds="800x400" title="Visual precision"
class:Service "Service" at (210, 200) #slate [attributes="- id: UUID" operations="+ execute(): void"]
class:Worker "Worker" at (590, 200) #blue [operations="+ run(): void"]

Worker.left -> Service.right #blue [ortho realization label="implements"]
```

<!-- /schemd-section -->

<!-- schemd-section: id=later; eyebrow=03 / Later · P1 + P2; title=Grow the language without growing the runtime; example-title=Language growth; example-summary=New symbols should share one bounded architecture. -->

These items grow the _language_ without growing the _runtime_ — and because the correctness work above can still reshape them, treat their final form as provisional rather than promised.

- [ ] **P1-01 · Built-in symbol registry.** Move parsing, ports, bounds, and primitives behind typed entries and publish a support matrix. [Claim P1-01](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P1-01%20%E2%80%94%20Built-in%20symbol%20registry)
- [ ] **P2-01 · Serializer byte result.** Reuse one internal `{ svg, bytes }` result and benchmark memory at the 2 MiB limit. [Claim P2-01](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P2-01%20%E2%80%94%20Serializer%20byte%20result)
- [ ] **P2-02 · Incremental document IDs.** Avoid allocating a full JSON signature and document unique prefixes for repeated diagrams. [Claim P2-02](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P2-02%20%E2%80%94%20Incremental%20document%20IDs)
- [ ] **P2-03 · Grammar delimiter escapes.** Support bounded `\\`, `\"`, and `\;` escapes with a small lexer. [Claim P2-03](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P2-03%20%E2%80%94%20Grammar%20delimiter%20escapes)
- [ ] **P2-04 · Shared external styling.** Let controlled hosts reuse one style asset while preserving self-contained SVG. [Claim P2-04](https://github.com/schemd/core/issues/new?template=roadmap.yml&title=%5BROADMAP%5D%20P2-04%20%E2%80%94%20Shared%20external%20styling)

```schemd bounds="960x480" title="Language growth"
port:INPUT "Sensor bus" at (60, 230) #blue
ic:U1 "Controller" at (480, 240) #cyan [left="DATA,ENABLE" right="ACTUATOR,FAULT" top="CLK,VCC" bottom="GND"]
port:OUTPUT "Actuator" at (900, 220) #emerald

INPUT.out -> U1.DATA #blue [ortho]
U1.ACTUATOR -> OUTPUT.in #emerald [ortho marker-end=arrow]
```

**Lifecycle:** this is an active queue, not a changelog. The PR that finishes an item deletes it — here and in the [GitHub roadmap](https://github.com/Sirneij/schemd/blob/main/ROADMAP.md) — and lets the issue, the merged PR, and the Git history keep the record.

<!-- /schemd-section -->
