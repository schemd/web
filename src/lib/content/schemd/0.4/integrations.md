<!-- schemd-doc: id=integrations; label=Interaction; title=Delegate interaction from one SVG root; summary=Use full-mode semantic datasets without regenerating the schematic for every state change.; category=Ship output; order=70 -->

<!-- schemd-section: id=delegation; eyebrow=01 / Events; title=Listen once and mutate state classes; example-title=Probe-ready digital path -->

Compile once in `full` mode. A single listener on the trusted host can resolve `event.target.closest('[data-node-id], [data-wire-source], [data-port-id]')`. Simulations should toggle classes or CSS custom properties; slider changes must not recompile the SVG tree.

```schemd bounds="860x340" title="Probe-ready digital path"
logic:ONE "1" at (80, 130) #blue [type=high]
buffer:T "tri-state" at (300, 130) #cyan [type=tristate]
clock:CLK "enable" at (300, 270) #amber
testpoint:TP "probe" at (530, 130) #purple
load:L "lamp" at (740, 130) #emerald [type=lamp]
ONE.out -> T.in1 #blue [digital line]
CLK.out -> T.enable #amber [digital ortho]
T.out1 -> TP.node #cyan [digital line]
TP.node -> L.in #emerald [digital line]
```

Source-to-vector mapping uses compiler-emitted one-based lines. Do not reparse the DSL with browser regexes; the server response already supplies the authoritative source map.

<!-- /schemd-section -->

<!-- schemd-section: id=accessibility; eyebrow=02 / Accessibility; title=Keep pointer and keyboard paths equivalent; example-title=Semantic measurement path -->

Node and port targets expose stable labels in the generated SVG. Custom host controls still need semantic buttons, current `aria-pressed`/`aria-expanded` state, visible focus, and keyboard activation.

```schemd bounds="760x320" title="Semantic measurement path"
prepare:P "|0\rangle" at (80, 130) #blue
rx:R "R_x" at (300, 130) #purple [parameter="\pi/2"]
measure:M "M" at (540, 130) #emerald
P.out -> R.in #blue [quantum line]
R.out -> M.in #purple [quantum line]
```

<!-- /schemd-section -->
