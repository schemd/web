<!-- schemd-doc: id=framework-adapters; label=UI frameworks; title=Keep the compiler at a trusted server boundary; summary=Render one deterministic SVG string in Svelte, React, Vue, Angular, or a build pipeline.; category=Connect toolchains; order=80 -->

<!-- schemd-section: id=server-boundary; eyebrow=01 / Host; title=Compile outside reactive component state; example-title=Framework-neutral source -->

The contract fits in one sentence: take the source and a validated fence, call `compileSchematic`, and mount the trusted result. A host should never import a DOM implementation, and it should never recompile because some unrelated piece of interface state changed. The compiler is a pure function of source and fence. Treating it as one keeps a component cheap.

```ts
export function renderDiagram(source: string) {
	return compileSchematic(source, {
		bounds: { width: 760, height: 340 },
		title: 'Framework-neutral source',
		mode: 'embedded-css'
	}).svg;
}
```

```schemd bounds="760x340" title="Framework-neutral source"
source:CELL4 "3 V" at (80, 130) #blue [type=battery]
resistor:RIND "100 \Omega" at (330, 130) #amber
diode:PWR "power" at (580, 130) #emerald [type=led]
ground:G4 at (580, 260) #slate

CELL4.positive -> RIND.in #blue [ortho]
RIND.out -> PWR.anode #amber [ortho]
PWR.cathode -> G4.in #slate [ortho]
```

In Svelte the SVG is derived from the source and the fence alone, while React memoizes on those same two values so that a re-render with unchanged inputs costs nothing at all. Vue and Angular pass the string through their boundary for trusted HTML. That boundary is meant for compiler output only. Arbitrary user HTML must never pass through it.

<!-- /schemd-section -->
