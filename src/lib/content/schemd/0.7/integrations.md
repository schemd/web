<!-- schemd-doc: id=integrations; label=Interaction; title=Delegate interaction from one SVG root; summary=Use full-mode semantic datasets without regenerating the schematic for every state change.; category=Ship output; order=70 -->

<!-- schemd-section: id=delegation; eyebrow=01 / Events; title=Listen once and mutate state classes; example-title=Probe-ready digital path -->

Compile once in `full` mode, then delegate. One listener on the host resolves `event.target.closest('[data-node-id], [data-wire-source], [data-port-id]')`, and that is the entire interaction layer. A simulation toggles classes or custom properties on whatever it finds; moving a slider must never recompile the tree. Application state lives outside the SVG — recompiling the same source is deterministic, so the drawing is safe to treat as disposable.

```schemd bounds="860x340" title="Probe-ready digital path"
port:REQ "REQ" at (80, 130) #blue
clock:TICK "TICK" at (80, 270) #amber
and:GK "AND" at (350, 130) #cyan [inputs=2]
testpoint:PRB "probe" at (590, 130) #purple
port:ACK "ACK" at (790, 130) #emerald [orientation=left]

REQ.out -> GK.in1 #blue [digital line]
TICK.out -> GK.in2 #amber [digital ortho]
GK.out1 -> PRB.node #cyan [digital line]
PRB.node -> ACK.in #emerald [digital line]
```

Source-to-vector mapping uses the compiler's own one-based lines. Do not reparse the language with a browser regex — the response already carries the authoritative source map, and a second parser is simply a second answer waiting to disagree.

<!-- /schemd-section -->

<!-- schemd-section: id=accessibility; eyebrow=02 / Accessibility; title=Keep pointer and keyboard paths equivalent; example-title=Semantic measurement path -->

Nodes and ports carry stable labels in the generated SVG, but that only covers what the compiler emitted. Anything we add around it is ours to make equivalent: semantic buttons, honest `aria-pressed`/`aria-expanded` state, visible focus, and keyboard activation for every path a pointer can take.

```schemd bounds="760x320" title="Semantic measurement path"
prepare:QI "|0\rangle" at (80, 130) #blue
hadamard:HI "H" at (300, 130) #cyan
qgate:PI "S" at (520, 130) #purple [parameter="\pi/2"]
measure:MI "M_z" at (700, 130) #emerald

QI.out -> HI.in #blue [quantum line]
HI.out -> PI.in #cyan [quantum line]
PI.out -> MI.in #purple [quantum line]
```

<!-- /schemd-section -->
