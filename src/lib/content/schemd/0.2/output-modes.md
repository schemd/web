<!-- schemd-doc: id=output-modes; label=Output modes; title=Choose how much SVG to emit; summary=Keep static diagrams small or add CSS and interaction hooks when a page needs them.; category=Ship output; order=60 -->

<!-- schemd-section: id=mode-selection; eyebrow=01 / Output; title=Pick a mode at the render boundary; example-title=Mode comparison; example-summary=The live preview recompiles one diagram in all three modes. -->

Here is the reassuring part: the geometry is identical in every mode. Same nodes, same routes, same coordinates — only the styling and interaction metadata change. So you can raise or lower the mode freely, and the drawing underneath never moves.

| Mode           | Adds                                   | Good fit                           |
| -------------- | -------------------------------------- | ---------------------------------- |
| `default`      | Minimal static SVG                     | Articles, email, PDF, image export |
| `embedded-css` | Built-in hover and focus styles        | Responsive documentation           |
| `full`         | CSS, `data-*` hooks, and focus targets | Editors, diagnostics, simulations  |

Choose the mode once, on the trusted server or build step:

```ts
renderSchematic(document, { ...fence, mode: 'full' });
```

Start at `default` and earn your way up — move to a richer mode only when the host actually consumes the extra behavior. And in `full` mode, you can trim the metadata you do not use without touching a single line of the drawing:

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
