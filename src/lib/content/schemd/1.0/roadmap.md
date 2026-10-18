<!-- schemd-doc: id=roadmap; label=Roadmap; title=What 1.0 shipped, and what is still open; summary=Release-ready capabilities, verification gates, publication order, and the boundaries outside the compiler.; category=Contribute; order=110 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Roadmap illustrations sketch shape, not a complete circuit. -->

<!-- schemd-section: id=complete; eyebrow=01 / Release; title=The 1.0 core is released; example-title=Cross-domain 1.0 specimen -->

1.0 rebuilt the compiler's core behind the same language and the same API. Every net is routed once on an integer lattice and grown as a tree, with contention negotiated away (PathFinder) rather than retried; wires written to a junction meet at it; a wire crossing its own net is dotted; geometry is exact integer milli-units throughout; text is measured against Arial's advances; every terminal of a digital block has a slot of its own; and `diagnoseSchematic` reports every problem in a document at once, with its columns.

Behind 1.0 sit 0.8's sub-circuits and trunk syntax, 0.6's `snapshotSchematic` and `parseSchematicSvg`, 0.5's relative placement, and 0.4's removal of the global component and connection ceilings. Quarter-turn geometry, typed primitives, net semantics, collision validation, netlist inspection, structural design rules, accessible descriptions, deterministic fuzzing, and source maps remain part of the same compiler.

```schemd bounds="980x420" title="Cross-domain 1.0 specimen"
source:AC1 "AC" at (90, 120) #purple [type=voltage-ac]
capacitor:CX1 "C" at (280, 120) #cyan
adder:FA1 "FA" at (500, 120) #amber [type=full]
qgate:QZ1 "R_z" at (710, 120) #blue [parameter="\lambda"]
component:LAB1 "lab" at (870, 290) #slate [width=150 height=80]
```

<!-- /schemd-section -->

<!-- schemd-section: id=verification; eyebrow=02 / Gate; title=Publish core before the website consumes it; example-title=Release-gate signal -->

The release gate runs type checking, 100% statement/branch/function/line coverage, bounded property
fuzzing, a seeded property search over random layouts that holds every drawing to the rules a
draughtsman checks by eye, a hundred targeted mutants with a 100% kill score, a 270-document
byte-identity corpus, six Chromium pixel goldens, installed package-boundary tests, gzip and
brotli-11 budgets, and latency/scaling ceilings. Those gates prove the
properties they assert. They do not prove a circuit is electrically safe, temporally correct,
standards-certified, or manufacturable.

Publication order is non-negotiable, and it is now automated rather than remembered. A tag push
publishes `@schemd/core` to npm and cuts the GitHub release from that version's `CHANGELOG.md`
section, so the prose is written once. A scheduled job on the website then adopts the release —
dependency and lockfile together, release snapshot regenerated from npm's own packument — runs the
complete web gate against it, and opens a pull request. Nothing merges itself, because a compiler
release is allowed to change rendered geometry and that is the part CI cannot judge.

The ordering matters for a reason worth stating plainly: a linked `dist/` proves local integration,
never that the published tarball and its export map work. Only an install from the registry does
that, which is why the sync job installs rather than links.

```schemd bounds="700x300" title="Release-gate signal"
logic:OK1 "1" at (100, 120) #purple [type=high]
testpoint:GATE1 "release gate" at (340, 120) #cyan
load:LAMP1 "lamp" at (590, 120) #emerald [type=lamp]

OK1.out -> GATE1.node #purple [digital line]
GATE1.node -> LAMP1.in #emerald [digital line]
```

Known boundaries remain deliberate: rotation is limited to quarter turns; text is measured for one
font stack rather than by a font engine, and is placed without regard to its neighbours; several
arrowed wires converging on one pin can meet four ways there; sub-circuits flatten into one model
rather than becoming sub-sheets; design rules are structural rather than SPICE, timing, or formal
verification; routing is deterministic and negotiated but bounded, not provably optimal; and
scalar/bus coercion is rejected instead of guessed. See [Limitations](/docs/1.0/overview#limitations)
and [Resource budgets](/docs/1.0/limits) before treating untrusted source as a server workload.

<!-- /schemd-section -->
