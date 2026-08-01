<!-- schemd-doc: id=responsive-svg; label=Responsive SVG; title=Scale exact geometry without layout shift; summary=Reserve the aspect ratio, preserve the viewBox, and keep rotated labels and ports stable.; category=Author diagrams; order=50 -->

<!-- schemd-section: id=intrinsic-sizing; eyebrow=01 / Layout; title=Reserve the canvas before SVG arrives; example-title=Responsive vertical filter -->

The compiler emits explicit `width`, `height`, and `viewBox`, so the page can reserve the exact space the vector will occupy before it arrives. Give the host the same `aspect-ratio` and cumulative layout shift goes to zero — the diagram is bounded before it is parsed, and this is where that pays.

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

```schemd bounds="840x360" title="Responsive vertical filter"
source:SAC "AC" at (80, 120) #blue [type=voltage-ac]
resistor:RV "R" at (280, 120) #amber
junction:JW "tap" at (460, 120) #cyan
inductor:LW "L" at (460, 240) #purple [orientation=down]
port:OUTW "out" at (720, 120) #emerald

SAC.positive -> RV.in #blue [line]
RV.out -> JW.node #amber [line]
JW.node -> LW.in #purple [ortho]
JW.node -> OUTW.in #emerald [line]
```

Labels are emitted outside the rotated vector group, so text stays upright at every viewport size while full-mode port hotspots stay aligned with the terminals they belong to. Scaling changes how large the drawing is, never what it says.

<!-- /schemd-section -->

<!-- schemd-section: id=containment; eyebrow=02 / Performance; title=Contain expensive host repaint; example-title=Compact status circuit -->

Reach for `content-visibility: auto` on a long gallery, with `contain-intrinsic-size` as the placeholder. And do not animate an SVG `d` string to move a panel — transform or fade the container instead. Path animation forces geometry work on every frame for motion the geometry was never part of.

```schemd bounds="700x280" title="Compact status circuit"
logic:HI "1" at (90, 120) #purple [type=high]
buffer:BS "schmitt" at (330, 120) #cyan [type=schmitt]
load:LM "lamp" at (590, 120) #emerald [type=lamp]

HI.out -> BS.in1 #purple [digital line]
BS.out1 -> LM.in #emerald [line]
```

<!-- /schemd-section -->
