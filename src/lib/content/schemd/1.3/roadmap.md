<!-- schemd-doc: id=roadmap; label=Roadmap; title=What 1.3 shipped, and what is still open; summary=Release-ready capabilities, verification gates, publication order, and the boundaries outside the compiler.; category=Contribute; order=110 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Roadmap illustrations sketch shape, not a complete circuit. -->

<!-- schemd-section: id=complete; eyebrow=01 / Release; title=1.3 describes every kind as data; example-title=Cross-domain 1.3 specimen -->

1.3 states what every component kind accepts, as data. `@schemd/core/schema` gives each kind its options, with their types, ranges and defaults, and `describeComponentPorts` asks the parser for a part's terminals with any options. A test in the compiler proves the schema against the parser for every kind and option, so it cannot drift. Nothing about compiling changes: the corpus of 270 documents is byte-identical to 1.2.0, and the [component datasheets](/components) on this site are printed from the new entry.

1.2 made the quoted label optional. A junction, a test point or a gate whose symbol already says what it is can be declared without one, and it draws its designator alone. Every 1.1 document compiled to the same bytes, and the change cost 35 bytes on the compile path. The request came from the CircuiTikZ converter now under way at [schemd/circuitikz](https://github.com/schemd/circuitikz), which has no label to give a part that the TeX left unlabelled.

1.1 added [`fit=wires`](/docs/1.3/fit), which lines a multi-qubit gate's rails or a block's pins up with the wires that reach them, and alignments that place a [terminal](/docs/1.3/placement#terminals) level with another part. Running the layout search with fitted parts also found two defects, and both were fixed. A repeated connection between junction ends crashed the compiler, and the lowest-rail terminal of a multi-track gate faced up, so a wire to it ran through the terminals above.

1.0 rebuilt the compiler's core behind the same language and the same API. Every net is routed once on an integer lattice and grown as a tree, and contention is negotiated away with PathFinder. Wires written to a junction meet at it, and a wire that crosses its own net is dotted. Geometry is exact integer milli-units throughout, and text is measured against Arial's advances. Every terminal of a digital block has a slot of its own, and `diagnoseSchematic` reports every problem in a document at once, with its columns.

Earlier releases remain part of the same compiler: 0.8's sub-circuits and trunk syntax, 0.6's `snapshotSchematic` and `parseSchematicSvg`, 0.5's relative placement, and 0.4's removal of the global ceilings on components and connections. So do quarter-turn geometry, typed primitives, net semantics, collision checks, netlist inspection, structural design rules, accessible descriptions, deterministic fuzzing and source maps.

`^1.3.0` is the version to install. On the 1.0 line, 1.0.1 is the code of 1.0.0 under a new number, because it was tagged before the intended fixes had merged; 1.0.2 carries those fixes.

One defect is known in 1.3, as it was in 1.2. The battery symbol draws its long plate, the positive one, on the side of the `negative` terminal, so every battery appears reversed. The connections are correct, and `buildNetlist` reports the right polarity. A fix that swaps the two plates is expected in a patch release.

```schemd bounds="980x420" title="Cross-domain 1.3 specimen"
source:PU4 "pulse" at (90, 120) #purple [type=voltage-pulse]
inductor:LX4 "L" at (280, 120) #cyan
decoder:DC4 "DEC" at (500, 120) #amber
hadamard:HQ4 at (710, 120) #blue
component:BOX4 "fixture" at (870, 290) #slate [width=150 height=80]
```

<!-- /schemd-section -->

<!-- schemd-section: id=verification; eyebrow=02 / Gate; title=Publish core before the website consumes it; example-title=Release signal -->

The release gate runs type checking and holds statement, branch, function and line coverage at 100%. It runs bounded property fuzzing and a seeded property search over random layouts, which holds every drawing to the rules a draughtsman checks by eye. 129 targeted mutants must all be killed, a corpus of 270 documents must stay byte-identical, and six Chromium pixel goldens must match. Installed package-boundary tests, gzip and brotli-11 budgets, and ceilings on latency and scaling complete the gate. A contract fuzzer breaks real documents the way an editor does in the middle of a keystroke. It then checks that `compileSchematic` throws only `SchematicSyntaxError`, that `diagnoseSchematic` never throws, and that the two agree.

Those gates prove the properties they assert. They do not prove that a circuit is electrically safe, correct in time, certified against a standard, or manufacturable.

The order of publication is fixed, and it is automated. A tag push publishes `@schemd/core` to npm and cuts the GitHub release from that version's section of `CHANGELOG.md`, so the prose is written once. The release workflow refuses a tag whose version has no changelog entry, and it checks this before anything reaches npm. A scheduled job on the website then adopts the release. It updates the dependency and the lockfile together, regenerates the release snapshot from npm's own packument, runs the complete web gate and opens a pull request. Nothing merges itself, since a compiler release may change rendered geometry, and that is the part CI cannot judge.

The order matters because a linked `dist/` proves only local integration. It never proves that the published tarball and its export map work. Only an install from the registry does that, and for this reason the job installs and never links.

```schemd bounds="700x300" title="Release signal"
logic:HI4 "1" at (100, 120) #purple [type=high]
testpoint:TAG4 "tag v1.3.0" at (340, 120) #cyan
load:BZ4 "buzzer" at (590, 120) #emerald [type=buzzer]

HI4.out -> TAG4.node #purple [digital line]
TAG4.node -> BZ4.in #emerald [digital line]
```

Some boundaries remain on purpose. Rotation is limited to quarter turns. Text is measured for one font stack with no font engine, and it is placed without regard to its neighbours. Several arrowed wires that converge on one pin can meet there from four sides, and two wires of one net can now and then share a run. A fitted part is placed before it fits. Sub-circuits flatten into one model and never become sub-sheets. The design rules are structural, with no SPICE, timing or formal verification. Routing is deterministic and negotiated, but bounded and not provably optimal, and a coercion between a scalar and a bus is rejected, never guessed. The [limitations](/docs/1.3/overview#limitations) and [resource budgets](/docs/1.3/limits) pages should be read before untrusted source is treated as a server workload.

<!-- /schemd-section -->
