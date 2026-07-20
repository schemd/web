<!-- schemd-doc: id=roadmap; label=Roadmap; title=Ship 0.3 without hiding its boundaries; summary=What is complete, what remains release metadata, and what is explicitly out of scope.; category=Contribute; order=110 -->

<!-- schemd-section: id=complete; eyebrow=01 / 0.3; title=Primitive and rotation work is complete; example-title=Cross-domain 0.3 specimen -->

Quarter-turn transforms, typed primitive families, polished `qgate`, semantic ports, bus-width checks, expanded UML relations, deterministic fuzzing, exact resource ceilings, and 100% core coverage are complete.

```schemd bounds="980x420" title="Cross-domain 0.3 specimen"
source:AC "AC" at (90, 120) #blue [type=voltage-ac]
capacitor:C "C" at (280, 120) #cyan [orientation=down]
adder:FA "FA" at (500, 120) #amber [type=full]
qgate:Q "R_z" at (710, 120) #purple [parameter="\theta"]
component:SYS "system" at (870, 290) #slate [width=150 height=80]
```

<!-- /schemd-section -->

<!-- schemd-section: id=release; eyebrow=02 / Gate; title=Publication metadata remains pending; example-title=Release-gate signal -->

The 0.3.0 documentation route is a deterministic prerelease fallback until npm publication. The timeline must replace the pending date and commit hash from registry/GitHub data after release. Phase 5 owns version changes, changelogs, README updates, tags, pushes, and npm publication authorization.

```schemd bounds="700x300" title="Release-gate signal"
logic:READY "1" at (100, 120) #blue [type=high]
testpoint:GATE "release gate" at (340, 120) #amber
load:L "lamp" at (590, 120) #emerald [type=lamp]
READY.out -> GATE.node #blue [digital line]
GATE.node -> L.in #emerald [line]
```

Known boundaries remain deliberate: no arbitrary-angle rotation, no browser font measurement, no unbounded plug-in renderer, and no silent scalar/bus coercion.

<!-- /schemd-section -->
