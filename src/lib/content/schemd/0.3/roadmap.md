<!-- schemd-doc: id=roadmap; label=Roadmap; title=Ship 0.3 without hiding its boundaries; summary=What is complete, what remains release metadata, and what is explicitly out of scope.; category=Contribute; order=110 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Roadmap illustrations sketch shape, not a complete circuit. -->

<!-- schemd-section: id=complete; eyebrow=01 / 0.3; title=Primitive and rotation work is complete; example-title=Cross-domain 0.3 specimen -->

Quarter-turn transforms, typed primitive families, polished `qgate`, semantic ports, bus-width checks, expanded UML relations, deterministic fuzzing, exact resource ceilings, and 100% core coverage are complete.

```schemd bounds="980x420" title="Cross-domain 0.3 specimen"
source:DC "DC" at (90, 130) #blue [type=voltage-dc]
inductor:LX "L" at (280, 130) #purple [orientation=down]
mux:MX "mux" at (520, 130) #amber [type=mux]
hadamard:HX "H" at (730, 130) #cyan
package:PKG "subsystem" at (860, 300) #slate [width=160 height=80]
```

<!-- /schemd-section -->

<!-- schemd-section: id=release; eyebrow=02 / Gate; title=Publication metadata remains pending; example-title=Release-gate signal -->

The 0.3 line documents releases 0.3.0 through the current 0.3.x patch; the newest release in the line is the deterministic fallback until npm publication confirms it. The timeline must replace the pending date and commit hash from registry/GitHub data after release. Phase 5 owns version changes, changelogs, README updates, tags, pushes, and npm publication authorization.

```schemd bounds="720x300" title="Release-gate signal"
logic:OK "1" at (100, 130) #blue [type=high]
comparator:CMP "gate" at (350, 130) #amber
load:BZ "sounder" at (600, 130) #emerald [type=buzzer]

OK.out -> CMP.in1 #blue [digital line]
CMP.eq -> BZ.in #emerald [digital line]
```

Known boundaries remain deliberate: no arbitrary-angle rotation, no browser font measurement, no unbounded plug-in renderer, and no silent scalar/bus coercion.

<!-- /schemd-section -->
