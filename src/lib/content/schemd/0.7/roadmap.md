<!-- schemd-doc: id=roadmap; label=Roadmap; title=What 0.7 shipped, and what is still open; summary=Release-ready capabilities, verification gates, publication order, and the boundaries outside the compiler.; category=Contribute; order=110 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Roadmap illustrations sketch shape, not a complete circuit. -->

<!-- schemd-section: id=complete; eyebrow=01 / Candidate; title=The 0.7 implementation is released; example-title=Cross-domain 0.7 specimen -->

0.7 adds bundle nudging: when the retry budget is exhausted the traces are laid out as a set rather
than reordered again, which carries a full reversal bus from twelve wires to thirty-two and reports
itself in `routing.nudged`. It also corrects a claim 0.5 published — thirteen wires was recorded as a
limit of the channel model rather than of declaration order, and the reasoning behind that was wrong
even though the measurement was sound.

0.6 before it added `snapshotSchematic` and `parseSchematicSvg` behind their own subpaths, and 0.5
added relative placement and bounded rip-up routing on top of 0.4, which removed the global component
and connection ceilings and added caller-controlled resource budgets, canonicalizes every port alias
before topology analysis, and closes routing defects around terminal approaches, reversal buses,
marker batching, and self-connections. Quarter-turn geometry, typed primitives, net semantics,
collision validation, netlist inspection, structural design rules, accessible descriptions,
deterministic fuzzing, and source maps remain part of the same compiler.

```schemd bounds="980x420" title="Cross-domain 0.7 specimen"
source:AC7 "AC" at (90, 120) #purple [type=voltage-ac]
capacitor:CD7 "C" at (280, 120) #cyan
adder:FA7 "FA" at (500, 120) #amber [type=full]
qgate:QZ7 "R_z" at (710, 120) #blue [parameter="\psi"]
component:RIG7 "rig" at (870, 290) #slate [width=150 height=80]
```

<!-- /schemd-section -->

<!-- schemd-section: id=verification; eyebrow=02 / Gate; title=Publish core before the website consumes it; example-title=Release-gate signal -->

The release gate runs type checking, 100% statement/branch/function/line coverage, bounded property
fuzzing, fourteen targeted mutants with a 100% kill score, six Chromium pixel goldens, installed
package-boundary tests, two gzip budgets, and latency/scaling ceilings. Those gates prove the
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
logic:ARM "1" at (100, 120) #purple [type=high]
testpoint:ARMTP "arm gate" at (340, 120) #cyan
load:FAN "blower" at (590, 120) #emerald [type=motor]

ARM.out -> ARMTP.node #purple [digital line]
ARMTP.node -> FAN.in #emerald [digital line]
```

Known boundaries remain deliberate: rotation is limited to quarter turns; text measurement is
deterministic rather than font-engine exact; the model is flat rather than hierarchical; design
rules are structural rather than SPICE, timing, or formal verification; routing is deterministic but
bounded; and scalar/bus coercion is rejected instead of guessed. See [Limitations](/docs/0.7/overview#limitations)
and [Resource budgets](/docs/0.7/limits) before treating untrusted source as a server workload.

<!-- /schemd-section -->
