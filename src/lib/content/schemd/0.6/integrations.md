<!-- schemd-doc: id=integrations; label=Interaction; title=Delegate interaction from one SVG root; summary=Use full-mode semantic datasets without regenerating the schematic for every state change.; category=Ship output; order=70 -->

<!-- schemd-section: id=delegation; eyebrow=01 / Events; title=Listen once and mutate state classes; example-title=Probe-ready digital path -->

Compile once in `full` mode, then delegate. One listener on the host resolves `event.target.closest('[data-node-id], [data-wire-source], [data-port-id]')`, and that is the entire interaction layer. A simulation toggles classes or custom properties on whatever it finds; moving a slider must never recompile the tree. Application state lives outside the SVG — recompiling the same source is deterministic, so the drawing is safe to treat as disposable.

```schemd bounds="860x340" title="Probe-ready digital path"
logic:ZERO "0" at (80, 130) #blue [type=low]
buffer:INV "inverter" at (300, 130) #cyan [type=schmitt-inverter]
clock:STROBE "strobe" at (300, 270) #amber
testpoint:TAP "tap" at (530, 130) #purple
load:BZ "buzzer" at (740, 130) #emerald [type=buzzer]

ZERO.out -> INV.in1 #blue [digital line]
STROBE.out -> TAP.node #amber [digital ortho]
INV.out1 -> TAP.node #cyan [digital line]
TAP.node -> BZ.in #emerald [digital line]
```

Source-to-vector mapping uses the compiler's own one-based lines. Do not reparse the language with a browser regex — the response already carries the authoritative source map, and a second parser is simply a second answer waiting to disagree.

<!-- /schemd-section -->

<!-- schemd-section: id=accessibility; eyebrow=02 / Accessibility; title=Keep pointer and keyboard paths equivalent; example-title=Semantic measurement path -->

Nodes and ports carry stable labels in the generated SVG, but that only covers what the compiler emitted. Anything we add around it is ours to make equivalent: semantic buttons, honest `aria-pressed`/`aria-expanded` state, visible focus, and keyboard activation for every path a pointer can take.

```schemd bounds="760x320" title="Semantic measurement path"
prepare:S "|1\rangle" at (80, 130) #blue
ry:RY "R_y" at (300, 130) #purple [parameter="\pi/4"]
measure:MZ "M" at (540, 130) #emerald

S.out -> RY.in #blue [quantum line]
RY.out -> MZ.in #purple [quantum line]
```

<!-- /schemd-section -->
