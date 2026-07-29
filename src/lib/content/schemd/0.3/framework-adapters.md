<!-- schemd-doc: id=framework-adapters; label=UI frameworks; title=Keep the compiler at a trusted server boundary; summary=Render one deterministic SVG string in Svelte, React, Vue, Angular, or a build pipeline.; category=Connect toolchains; order=80 -->

<!-- schemd-section: id=server-boundary; eyebrow=01 / Host; title=Compile outside reactive component state; example-title=Framework-neutral source -->

The contract is one sentence: take source plus a validated fence, call `compileSchematic`, mount the trusted result. Never import a DOM implementation, and never recompile because some unrelated piece of UI state moved.

```ts
export function renderDiagram(source: string) {
	return compileSchematic(source, {
		bounds: { width: 760, height: 340 },
		title: 'Line-level buffer',
		mode: 'embedded-css'
	}).svg;
}
```

```schemd bounds="760x340" title="Line-level buffer"
connector:J1 "line in" at (90, 150) #blue
transistor:Q1 "buffer" at (340, 150) #cyan [type=njfet]
connector:J2 "line out" at (640, 150) #emerald

J1.out -> Q1.gate #blue [line]
Q1.drain -> J2.in #emerald [line marker-end=arrow]
```

Svelte should derive the SVG from the source and fence alone; React should memoize on those same two values. Vue and Angular treat the result as trusted server output — and note that this door is for compiler output only, never for arbitrary user HTML.

<!-- /schemd-section -->
