<!-- schemd-doc: id=roadmap; label=Roadmap; title=Prepare 0.4 without pretending it is published; summary=Release-ready capabilities, verification gates, publication order, and the boundaries outside the compiler.; category=Contribute; order=110 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Roadmap illustrations sketch shape, not a complete circuit. -->

<!-- schemd-section: id=complete; eyebrow=01 / Candidate; title=The 0.4 implementation is release-ready; example-title=Cross-domain 0.4 specimen -->

The 0.4 candidate removes global component and connection ceilings, adds caller-controlled resource
budgets, canonicalizes every port alias before topology analysis, and closes routing defects around
terminal approaches, reversal buses, marker batching, and self-connections. Quarter-turn geometry,
typed primitives, net semantics, collision validation, netlist inspection, structural design rules,
accessible descriptions, deterministic fuzzing, and source maps remain part of the same compiler.

```schemd bounds="980x420" title="Cross-domain 0.4 specimen"
source:AC "AC" at (90, 120) #blue [type=voltage-ac]
capacitor:C "C" at (280, 120) #cyan [orientation=down]
adder:FA "FA" at (500, 120) #amber [type=full]
qgate:Q "R_z" at (710, 120) #purple [parameter="\theta"]
component:SYS "system" at (870, 290) #slate [width=150 height=80]
```

<!-- /schemd-section -->

<!-- schemd-section: id=verification; eyebrow=02 / Gate; title=Publish core before the website consumes it; example-title=Release-gate signal -->

The release gate runs type checking, 100% statement/branch/function/line coverage, bounded property
fuzzing, fourteen targeted mutants with a 100% kill score, six Chromium pixel goldens, installed
package-boundary tests, two gzip budgets, and latency/scaling ceilings. Those gates prove the
properties they assert. They do not prove a circuit is electrically safe, temporally correct,
standards-certified, or manufacturable.

Until npm’s `latest` tag names `0.4.0`, the website must use a verified local package build during
development. Publication order is non-negotiable: publish `@schemd/core@0.4.0`, install it into the
web project from the registry, rerun the complete web gate, and only then deploy the website. A
linked `dist/` proves local integration; it does not prove the published tarball or export map works.

```schemd bounds="700x300" title="Release-gate signal"
logic:READY "1" at (100, 120) #blue [type=high]
testpoint:GATE "release gate" at (340, 120) #amber
load:L "lamp" at (590, 120) #emerald [type=lamp]
READY.out -> GATE.node #blue [digital line]
GATE.node -> L.in #emerald [digital line]
```

Known boundaries remain deliberate: rotation is limited to quarter turns; text measurement is
deterministic rather than font-engine exact; the model is flat rather than hierarchical; design
rules are structural rather than SPICE, timing, or formal verification; routing is deterministic but
bounded; and scalar/bus coercion is rejected instead of guessed. See [Limitations](/docs/0.4/overview#limitations)
and [Resource budgets](/docs/0.4/limits) before treating untrusted source as a server workload.

<!-- /schemd-section -->
