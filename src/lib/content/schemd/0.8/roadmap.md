<!-- schemd-doc: id=roadmap; label=Roadmap; title=What 0.8 shipped, and what is still open; summary=Release-ready capabilities, verification gates, publication order, and the boundaries outside the compiler.; category=Contribute; order=110 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Roadmap illustrations sketch shape, not a complete circuit. -->

<!-- schemd-section: id=complete; eyebrow=01 / Candidate; title=The 0.8 implementation is released; example-title=Cross-domain 0.8 specimen -->

0.8 adds two pieces of syntax and a faster router. `trunk` draws a multi-terminal net as a tree:
a branch leaves the nearest copper its net already has, with a junction dot, instead of running back
to its own terminal. `subcircuit` blocks are written once and placed many times, with parameters,
exposed terminals and nesting, and are lowered to ordinary declarations before anything else reads
the document. And the sparse router prices each grid edge once per route, which compiles a contended
bus about one and a half times faster with byte-identical output.

0.7 before it added bundle nudging, which carries a full reversal bus from twelve wires to
thirty-two and corrected a limit 0.5 had published; 0.6 added `snapshotSchematic` and
`parseSchematicSvg` behind their own subpaths; and 0.5 added relative placement and bounded rip-up
routing on top of 0.4's removal of the global component and connection ceilings. Quarter-turn
geometry, typed primitives, net semantics, collision validation, netlist inspection, structural
design rules, accessible descriptions, deterministic fuzzing, and source maps remain part of the
same compiler.

```schemd bounds="980x420" title="Cross-domain 0.8 specimen"
source:DC8 "DC" at (90, 120) #purple [type=voltage-dc]
inductor:LX8 "L" at (280, 120) #cyan
adder:HA8 "HA" at (500, 120) #amber [type=half]
qgate:QY8 "R_y" at (710, 120) #blue [parameter="\chi"]
component:BENCH8 "bench" at (870, 290) #slate [width=150 height=80]
```

<!-- /schemd-section -->

<!-- schemd-section: id=verification; eyebrow=02 / Gate; title=Publish core before the website consumes it; example-title=Release-gate signal -->

The release gate runs type checking, 100% statement/branch/function/line coverage, bounded property
fuzzing, sixty-one targeted mutants with a 100% kill score, a 270-document byte-identity corpus,
six Chromium pixel goldens, installed package-boundary tests, two gzip budgets, and latency/scaling
ceilings. Those gates prove the
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
logic:GO "1" at (100, 120) #purple [type=high]
testpoint:GATE8 "publish gate" at (340, 120) #cyan
load:BELL "bell" at (590, 120) #emerald [type=buzzer]

GO.out -> GATE8.node #purple [digital line]
GATE8.node -> BELL.in #emerald [digital line]
```

Known boundaries remain deliberate: rotation is limited to quarter turns; text measurement is
deterministic rather than font-engine exact; sub-circuits flatten into one model rather than becoming sub-sheets; design
rules are structural rather than SPICE, timing, or formal verification; a trunk is the sequential
approximation to a Steiner tree rather than the shortest one; routing is deterministic but
bounded; and scalar/bus coercion is rejected instead of guessed. See [Limitations](/docs/0.8/overview#limitations)
and [Resource budgets](/docs/0.8/limits) before treating untrusted source as a server workload.

<!-- /schemd-section -->
