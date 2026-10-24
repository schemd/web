<!-- schemd-doc: id=roadmap; label=Roadmap; title=What 1.1 shipped, and what is still open; summary=Release-ready capabilities, verification gates, publication order, and the boundaries outside the compiler.; category=Contribute; order=110 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Roadmap illustrations sketch shape, not a complete circuit. -->

<!-- schemd-section: id=complete; eyebrow=01 / Release; title=1.1 fits parts to their wires; example-title=Cross-domain 1.1 specimen -->

1.1 adds two things and redraws nothing: [`fit=wires`](/docs/1.1/fit), which lines a multi-qubit gate's rails or a block's pins up with the wires that reach them, and alignments that line up a [terminal](/docs/1.1/placement#terminals) rather than a centre. Every 1.0 document compiles to the same bytes. Running the layout search with fitted parts also found two defects, both fixed: a repeated connection between junction ends that crashed the compiler, and the lowest-rail terminal of a multi-track gate facing up, so a wire to it ran through the terminals above.

1.0 rebuilt the compiler's core behind the same language and the same API. Every net is routed once on an integer lattice and grown as a tree, with contention negotiated away (PathFinder) rather than retried; wires written to a junction meet at it; a wire crossing its own net is dotted; geometry is exact integer milli-units throughout; text is measured against Arial's advances; every terminal of a digital block has a slot of its own; and `diagnoseSchematic` reports every problem in a document at once, with its columns.

Behind 1.0 sit 0.8's sub-circuits and trunk syntax, 0.6's `snapshotSchematic` and `parseSchematicSvg`, 0.5's relative placement, and 0.4's removal of the global component and connection ceilings. Quarter-turn geometry, typed primitives, net semantics, collision validation, netlist inspection, structural design rules, accessible descriptions, deterministic fuzzing, and source maps remain part of the same compiler.

**Install `^1.1.0`.** On the 1.0 line, 1.0.1 is 1.0.0's code under a new number: it was tagged before the fixes meant for it had merged, so upgrading from 1.0.0 to 1.0.1 changes nothing. 1.0.2 carries those fixes and one found by fuzzing:

- A part placed relative to a declaration that failed is left unplaced without a second diagnostic, instead of being told that declaration "the document never declares".
- A broken relative placement no longer hides a mistyped terminal elsewhere: `diagnoseSchematic` checks every connection either way.
- A connection to a [junction](/docs/1.1/nets#junctions) that its net's copper already runs through follows that copper, instead of drawing a small detour loop beside the dot.

1.0.2 also added a contract fuzzer to the compiler's release gate, and 1.1 seeds it with fitted documents too. It breaks real documents the way an editor does mid-keystroke, then checks that `compileSchematic` throws only `SchematicSyntaxError`, that `diagnoseSchematic` never throws, and that the two agree. The release workflow now refuses a tag whose version has no changelog entry, and checks this before anything reaches npm.

```schemd bounds="980x420" title="Cross-domain 1.1 specimen"
source:DC2 "DC" at (90, 120) #purple [type=voltage-dc]
inductor:LX2 "L" at (280, 120) #cyan
counter:CT2 "CTR" at (500, 120) #amber
ugate:QU2 "U" at (710, 120) #blue [parameter="\theta, \phi"]
component:BENCH2 "bench" at (870, 290) #slate [width=150 height=80]
```

<!-- /schemd-section -->

<!-- schemd-section: id=verification; eyebrow=02 / Gate; title=Publish core before the website consumes it; example-title=Publish signal -->

The release gate runs type checking, 100% statement/branch/function/line coverage, bounded property
fuzzing, a seeded property search over random layouts that holds every drawing to the rules a
draughtsman checks by eye, 115 targeted mutants with a 100% kill score, a 270-document
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

```schemd bounds="700x300" title="Publish signal"
logic:HI2 "1" at (100, 120) #purple [type=high]
testpoint:TAG2 "tag v1.1.0" at (340, 120) #cyan
load:BELL2 "bell" at (590, 120) #emerald [type=buzzer]

HI2.out -> TAG2.node #purple [digital line]
TAG2.node -> BELL2.in #emerald [digital line]
```

Known boundaries remain deliberate: rotation is limited to quarter turns; text is measured for one
font stack rather than by a font engine, and is placed without regard to its neighbours; several
arrowed wires converging on one pin can meet four ways there; two wires of one net can occasionally overlap on a run; a fitted part is placed before it fits; sub-circuits flatten into one model
rather than becoming sub-sheets; design rules are structural rather than SPICE, timing, or formal
verification; routing is deterministic and negotiated but bounded, not provably optimal; and
scalar/bus coercion is rejected instead of guessed. See [Limitations](/docs/1.1/overview#limitations)
and [Resource budgets](/docs/1.1/limits) before treating untrusted source as a server workload.

<!-- /schemd-section -->
