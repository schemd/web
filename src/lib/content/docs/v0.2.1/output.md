<!-- schemd-doc: id=output; label=Output + labels; title=Control labels, sizing, and SVG output; summary=Use micro-math, stable viewBoxes, output modes, and semantic hooks without a browser layout pass.; category=Ship output; order=40 -->

<!-- schemd-section: id=math-labels; eyebrow=01 / Labels; title=Write compact engineering math -->

Use `_x` or `^2` for one shifted character. Use braces for a group: `V_{out}`, `f^{2n}`, or `A_{x_{sub}}`. Scripts may nest and return to the correct parent baseline.

Common commands include `\alpha`, `\beta`, `\Delta`, `\lambda`, `\mu`, `\Omega`, `\omega`, `\phi`, `\pi`, `\sigma`, `\theta`, `\times`, `\pm`, `\infty`, `\sqrt`, and `\rightarrow`.

```schemd bounds="920x320" title="Nested engineering labels"
port:VIN "V_{in} = 1 V" at (80, 160) #blue
resistor:R1 "R_{load} = 10 k\Omega" at (335, 160) #amber
capacitor:C1 "C_f e^{x^2}" at (590, 160) #cyan
port:VOUT "A_{x_{sub}} done" at (840, 160) #emerald

VIN.out -> R1.in #blue [line]
R1.out -> C1.in #amber [line]
C1.out -> VOUT.in #emerald [line marker-end=arrow]
```

Unknown command names stay visible. Labels are escaped before serialization. Glyph widths are estimated without loading a font, so exact metrics still depend on the host font.

<!-- /schemd-section -->

<!-- schemd-section: id=responsive-svg; eyebrow=02 / Sizing; title=Let the viewBox scale one diagram everywhere -->

Do not recalculate coordinates in the browser. Schemd emits a stable `viewBox`; the host controls only the display width.

```css
.schemd-host {
	--schematic-surface: Canvas;
	overflow: auto;
}

.schemd-host svg {
	display: block;
	width: 100%;
	height: auto;
}
```

Set `--schematic-surface` to the host background so hollow UML markers and connector-label halos cover the wire beneath them. If a dense diagram becomes unreadable on a phone, preserve its minimum readable width and allow horizontal scrolling.

<!-- /schemd-section -->

<!-- schemd-section: id=output-modes; eyebrow=03 / Modes; title=Emit only the SVG behaviour the host uses -->

The geometry is identical in every output mode. Only styling and interaction metadata change.

| Mode           | Adds                               | Good fit                     |
| -------------- | ---------------------------------- | ---------------------------- |
| `default`      | Minimal static SVG                 | Articles, email, PDF, export |
| `embedded-css` | Built-in focus and hover styles    | Responsive documentation     |
| `full`         | CSS, data hooks, and focus targets | Editors and simulations      |

```ts
compileSchematic(source, {
	...fence,
	mode: 'full',
	semanticHooks: ['nodes', 'wires']
});
```

Start with `default`. Move to a richer mode only when the host actually consumes it.

<!-- /schemd-section -->
