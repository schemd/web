<!-- schemd-doc: id=output-modes; label=Output modes; title=Choose how much SVG to emit; summary=Keep static diagrams small or add CSS and interaction hooks when a page needs them.; category=Ship output; order=60 -->

<!-- schemd-section: id=mode-selection; eyebrow=01 / Output; title=Pick a mode at the render boundary; example-title=Mode comparison; example-summary=The live preview recompiles one diagram in all three modes. -->

The geometry is the same in every mode. Only styling and interaction metadata change.

| Mode           | Adds                                   | Good fit                           |
| -------------- | -------------------------------------- | ---------------------------------- |
| `default`      | Minimal static SVG                     | Articles, email, PDF, image export |
| `embedded-css` | Built-in hover and focus styles        | Responsive documentation           |
| `full`         | CSS, `data-*` hooks, and focus targets | Editors, diagnostics, simulations  |

Choose the mode on the trusted server or build step:

```ts
renderSchematic(document, { ...fence, mode: 'full' });
```

Start with `default`. Move up only when the host actually uses the extra behavior.

In `full` mode, trim unused metadata without changing the drawing:

```ts
compileSchematic(source, {
	...fence,
	mode: 'full',
	semanticHooks: ['nodes', 'wires']
});
```

```schemd bounds="760x300" title="Mode comparison"
port:IN "Input" at (70, 150) #blue
nand:G1 "Safety inhibit" at (380, 150) #amber [inputs=2 outputs=1 standard=iec]
port:OUT "Output" at (690, 150) #emerald

IN.out -> G1.in1 #blue [bezier]
IN.out -> G1.in2 #slate [bezier]
G1.out -> OUT.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->
