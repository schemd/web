<!-- schemd-doc: id=integrations; label=Interaction; title=Delegate interaction from one SVG root; summary=Use full-mode semantic datasets without regenerating the schematic for every state change.; category=Ship output; order=70 -->

<!-- schemd-section: id=delegation; eyebrow=01 / Events; title=Listen once and mutate state classes; example-title=Probe-ready digital path -->

A diagram is compiled once in `full` mode, and interaction is then delegated. One listener on the host resolves `event.target.closest('[data-node-id], [data-wire-source], [data-port-id]')`, and that is the entire interaction layer. A simulation toggles classes or custom properties on whatever it finds. Nothing is recompiled. Application state lives outside the SVG, and recompiling the same source is deterministic, so the drawing can be treated as disposable.

```schemd bounds="860x340" title="Probe-ready digital path"
port:REQ2 "REQ" at (80, 130) #blue
clock:MCK at (80, 270) #amber
nor:ARB3 "NOR" at (350, 130) #cyan [inputs=2]
testpoint:TPC at (590, 130) #purple
port:IDLE at (790, 130) #emerald

REQ2.out -> ARB3.in1 #blue [digital ortho]
MCK.out -> ARB3.in2 #amber [digital ortho]
ARB3.out1 -> TPC.node #cyan [digital ortho]
TPC.node -> IDLE.in #emerald [digital ortho]
```

The mapping from source to vector uses the compiler's own one-based lines. No second parser is needed. The response already carries the authoritative source map, and a second parser is a second answer that will sooner or later disagree.

<!-- /schemd-section -->

<!-- schemd-section: id=accessibility; eyebrow=02 / Accessibility; title=Keep pointer and keyboard paths equivalent; example-title=Accessible measurement path -->

Nodes and ports carry stable labels in the generated SVG, but that covers only what the compiler emitted. Anything a host adds around it must be made equivalent by the host. That means semantic buttons, honest `aria-pressed` and `aria-expanded` state, visible focus, and keyboard activation for every path a pointer can take.

```schemd bounds="760x320" title="Accessible measurement path"
prepare:QN "|0\rangle" at (80, 130) #blue
sgate:SN at (300, 130) #cyan
qgate:PN "P" at (520, 130) #purple [parameter="\pi/8"]
measure:MN "M_y" at (700, 130) #emerald

QN.out -> SN.in #blue [quantum line]
SN.out -> PN.in #cyan [quantum line]
PN.out -> MN.in #purple [quantum line]
```

A part declared without a label keeps a complete accessible name in `full` mode, such as `SN, sgate`, with no empty field.

<!-- /schemd-section -->
