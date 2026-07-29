<!-- schemd-doc: id=responsive-svg; label=Responsive SVG; title=Scale exact geometry without layout shift; summary=Reserve the aspect ratio, preserve the viewBox, and keep rotated labels and ports stable.; category=Author diagrams; order=50 -->

<!-- schemd-section: id=intrinsic-sizing; eyebrow=01 / Layout; title=Reserve the canvas before SVG arrives; example-title=Responsive vertical filter -->

The compiler emits explicit `width`, `height`, and `viewBox`. Put the result in a host with the same `aspect-ratio`; the browser can reserve space during SSR and avoid cumulative layout shift.

```css
.schemd-frame {
	aspect-ratio: 840 / 360;
	contain: layout paint;
}
.schemd-frame > svg {
	display: block;
	inline-size: 100%;
	block-size: auto;
}
```

```schemd bounds="880x400" title="Responsive LR network"
source:IN "AC" at (90, 130) #blue [type=voltage-ac]
inductor:L "L" at (300, 130) #purple
junction:J "tap" at (500, 130) #cyan
resistor:R "R" at (500, 260) #amber [orientation=down]
port:OUT "out" at (760, 130) #emerald

IN.positive -> L.in #blue [line]
L.out -> J.node #purple [line]
J.node -> R.in #amber [ortho]
J.node -> OUT.in #emerald [line marker-end=arrow]
```

Component labels are emitted outside the rotated vector group. Text therefore stays upright at every viewport size, while full-mode port hotspots remain aligned with the transformed terminals.

<!-- /schemd-section -->

<!-- schemd-section: id=containment; eyebrow=02 / Performance; title=Contain expensive host repaint; example-title=Compact status circuit -->

Use `content-visibility: auto` for long galleries and `contain-intrinsic-size` as a fallback. Do not animate SVG `d` strings for panel motion; transform or fade the containing panel instead.

```schemd bounds="740x300" title="Compact status circuit"
logic:UNK "X" at (100, 130) #slate [type=unknown]
buffer:B "inverting" at (350, 130) #cyan [type=schmitt-inverter]
load:SPK "speaker" at (620, 130) #emerald [type=speaker]

UNK.out -> B.in1 #slate [digital line]
B.out1 -> SPK.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->
