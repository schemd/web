<!-- schemd-doc: id=responsive-svg; label=Responsive SVG; title=Scale one diagram everywhere; summary=Let the SVG viewBox preserve geometry while the host chooses its display size.; category=Author diagrams; order=50 -->

<!-- schemd-section: id=intrinsic-sizing; eyebrow=01 / Sizing; title=Let the viewBox do the scaling; example-title=Responsive telemetry path; example-summary=One SVG works in a narrow card or a wide documentation rail. -->

Do not recalculate diagram coordinates in the browser. Schemd emits a stable `viewBox`, so the host only needs to control width.

```css
.schemd-host {
	--schematic-surface: var(--page-surface, Canvas);
	container-type: inline-size;
}

.schemd-host svg {
	display: block;
	width: 100%;
	height: auto;
}

@container (max-width: 32rem) {
	.schemd-host {
		padding: 0.5rem;
	}
}
```

Set `--schematic-surface` to the host background. Hollow UML markers and connector-label halos use it to cover the wire beneath them.

Keep the aspect ratio reserved while content loads to avoid layout shift. If a dense diagram becomes unreadable on a phone, offer horizontal scrolling or a larger view instead of shrinking labels indefinitely.

```schemd bounds="960x360" title="Responsive telemetry path"
port:BUS "Sensor bus" at (70, 180) #blue
ic:U1 "Signal processor" at (330, 180) #cyan [left="CLK,DATA,ENABLE" right="FILTERED,FAULT"]
qgate:Q1 "Phase estimator" at (610, 120) #purple [parameter="\theta/2"]
port:OUT "Telemetry" at (875, 180) #emerald

BUS.out -> U1.DATA #blue [ortho]
U1.FILTERED -> Q1.in #purple [bezier]
Q1.out -> OUT.in #emerald [bezier marker-end=arrow]
U1.FAULT -> OUT.in #amber [ortho marker-end=dot]
```

<!-- /schemd-section -->
