<!-- schemd-doc: id=responsive-svg; label=Responsive SVG; title=Scale exact geometry without layout shift; summary=Reserve the aspect ratio, preserve the viewBox, and keep rotated labels and ports stable.; category=Author diagrams; order=50 -->

<!-- schemd-section: id=intrinsic-sizing; eyebrow=01 / Layout; title=Reserve the canvas before SVG arrives; example-title=Responsive RC high-pass -->

The compiler emits an explicit `width`, `height` and `viewBox`, so a page can reserve the exact space the drawing will occupy before it arrives. The host is given the same `aspect-ratio`. Nothing then shifts. Because the diagram is bounded before it is parsed, the page knows its size before a single path has been read, and this is where that bound pays off.

```css
.schemd-frame {
	aspect-ratio: 840 / 380;
	contain: layout paint;
}
.schemd-frame > svg {
	display: block;
	inline-size: 100%;
	block-size: auto;
}
```

```schemd bounds="840x380" title="Responsive RC high-pass"
source:SRC5 "AC" at (80, 120) #blue [type=voltage-ac]
capacitor:CS5 "C" at (280, 120) #cyan
junction:JN5 at (460, 120) #cyan
resistor:RS5 "R" at (460, 240) #amber [orientation=down]
port:VO5 "out" at (720, 120) #emerald

SRC5.positive -> CS5.in #blue [ortho]
CS5.out -> JN5.node #cyan [ortho]
JN5.node -> RS5.in #amber [ortho]
JN5.node -> VO5.in #emerald [ortho]
```

Labels are emitted outside the rotated vector group. Text therefore stays upright at every viewport size, and the port hotspots of `full` mode stay aligned with their terminals. Scaling changes the size. The content stays fixed.

<!-- /schemd-section -->

<!-- schemd-section: id=containment; eyebrow=02 / Performance; title=Contain expensive host repaint; example-title=Compact tone circuit -->

A long gallery benefits from `content-visibility: auto`, with `contain-intrinsic-size` as the placeholder. An SVG `d` string should never be animated to move a panel; the container should be transformed or faded. Path animation forces geometry work on every frame for a motion the geometry was never part of.

```schemd bounds="700x280" title="Compact tone circuit"
logic:LO5 "0" at (90, 120) #purple [type=low]
buffer:IV5 "invert" at (330, 120) #cyan [type=schmitt-inverter]
load:SP5 "speaker" at (590, 120) #emerald [type=speaker]

LO5.out -> IV5.in1 #purple [digital line]
IV5.out1 -> SP5.in #emerald [line]
```

<!-- /schemd-section -->
