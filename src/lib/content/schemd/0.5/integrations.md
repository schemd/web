<!-- schemd-doc: id=integrations; label=Interaction; title=Delegate interaction from one SVG root; summary=Use full-mode semantic datasets without regenerating the schematic for every state change.; category=Ship output; order=70 -->

<!-- schemd-section: id=delegation; eyebrow=01 / Events; title=Listen once and mutate state classes; example-title=Probe-ready digital path -->

Compile once in `full` mode, then delegate. One listener on the host resolves `event.target.closest('[data-node-id], [data-wire-source], [data-port-id]')`, and that is the entire interaction layer. A simulation toggles classes or custom properties on whatever it finds; moving a slider must never recompile the tree. Application state lives outside the SVG — recompiling the same source is deterministic, so the drawing is safe to treat as disposable.

```schemd bounds="860x340" title="Probe-ready digital path"
logic:ONE "1" at (80, 110) #blue [type=high]
buffer:T "tri-state" right-of ONE by 130 #cyan [type=tristate]
clock:CLK "enable" below T by 30 aligned-x with T #amber
testpoint:TP "probe" right-of T by 140 aligned-y with ONE #purple
load:L "lamp" right-of TP by 130 #emerald [type=lamp]

ONE.out -> T.in1 #blue [digital line]
CLK.out -> T.enable #amber [digital ortho]
T.out1 -> TP.node #cyan [digital line]
TP.node -> L.in #emerald [digital line]
```

Source-to-vector mapping uses the compiler's own one-based lines. Do not reparse the language with a browser regex — the response already carries the authoritative source map, and a second parser is simply a second answer waiting to disagree.

<!-- /schemd-section -->

<!-- schemd-section: id=accessibility; eyebrow=02 / Accessibility; title=Keep pointer and keyboard paths equivalent; example-title=Semantic measurement path -->

Nodes and ports carry stable labels in the generated SVG, but that only covers what the compiler emitted. Anything we add around it is ours to make equivalent: semantic buttons, honest `aria-pressed`/`aria-expanded` state, visible focus, and keyboard activation for every path a pointer can take.

```schemd bounds="760x320" title="Semantic measurement path"
prepare:P "|0\rangle" at (80, 130) #blue
rx:R "R_x" right-of P by 140 #purple [parameter="\pi/2"]
measure:M "M" right-of R by 160 #emerald

P.out -> R.in #blue [quantum line]
R.out -> M.in #purple [quantum line]
```

<!-- /schemd-section -->
