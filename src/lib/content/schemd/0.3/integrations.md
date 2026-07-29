<!-- schemd-doc: id=integrations; label=Interaction; title=Delegate interaction from one SVG root; summary=Use full-mode semantic datasets without regenerating the schematic for every state change.; category=Ship output; order=70 -->

<!-- schemd-section: id=delegation; eyebrow=01 / Events; title=Listen once and mutate state classes; example-title=Probe-ready digital path -->

Compile once in `full` mode, then delegate. One listener on the host resolves `event.target.closest('[data-node-id], [data-wire-source], [data-port-id]')` and that is the whole interaction layer. A simulation toggles classes or custom properties on what it finds; moving a slider must never recompile the tree.

```schemd bounds="900x420" title="Probe-ready toggle path"
logic:HI "1" at (110, 120) #slate [type=high]
clock:CLK "f_s" at (110, 300) #amber
flipflop:FF "T" at (380, 210) #cyan [type=t]
testpoint:TP "probe" at (620, 210) #purple
load:LED "indicator" at (810, 210) #emerald [type=lamp]

HI.out -> FF.enable #slate [digital ortho]
CLK.out -> FF.clock #amber [digital ortho]
FF.q -> TP.node #cyan [digital line]
TP.node -> LED.in #emerald [digital line]
```

Source-to-vector mapping uses the compiler's own one-based lines. Do not reparse the language with a browser regex — the response already carries the authoritative source map, and a second parser is a second answer.

<!-- /schemd-section -->

<!-- schemd-section: id=accessibility; eyebrow=02 / Accessibility; title=Keep pointer and keyboard paths equivalent; example-title=Semantic measurement path -->

Node and port targets expose stable labels in the generated SVG. Custom host controls still need semantic buttons, current `aria-pressed`/`aria-expanded` state, visible focus, and keyboard activation.

```schemd bounds="800x330" title="Semantic measurement path"
prepare:P "|0\rangle" at (90, 150) #blue
sgate:S "S" at (320, 150) #cyan
tgate:T "T" at (520, 150) #purple
measure:M "M" at (710, 150) #emerald

P.out -> S.in #blue [quantum line]
S.out -> T.in #cyan [quantum line]
T.out -> M.in #purple [quantum line]
```

<!-- /schemd-section -->
