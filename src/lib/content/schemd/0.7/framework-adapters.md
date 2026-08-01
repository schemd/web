<!-- schemd-doc: id=framework-adapters; label=UI frameworks; title=Keep the compiler at a trusted server boundary; summary=Render one deterministic SVG string in Svelte, React, Vue, Angular, or a build pipeline.; category=Connect toolchains; order=80 -->

<!-- schemd-section: id=server-boundary; eyebrow=01 / Host; title=Compile outside reactive component state; example-title=Framework-neutral source -->

The contract is one sentence: take source plus a validated fence, call `compileSchematic`, mount the trusted result. Never import a DOM implementation, and never recompile because some unrelated piece of UI state moved — the compiler is a pure function of source and fence, and treating it as one is what keeps a component cheap.

```ts
export function renderDiagram(source: string) {
	return compileSchematic(source, {
		bounds: { width: 760, height: 320 },
		title: 'Framework-neutral source',
		mode: 'embedded-css'
	}).svg;
}
```

```schemd bounds="760x320" title="Framework-neutral source"
source:PSU "5 V" at (80, 130) #blue [type=voltage-dc]
resistor:RS "220 \Omega" at (330, 130) #amber
diode:D1 "LED" at (580, 130) #emerald [type=led]
ground:GF "0 V" at (580, 250) #slate

PSU.positive -> RS.in #blue [line]
RS.out -> D1.anode #amber [line]
D1.cathode -> GF.in #emerald [ortho]
```

Svelte derives the SVG from source and fence alone; React memoizes on those same two values; Vue and Angular hand the string through their trusted-HTML boundary. Note that this boundary is for compiler output and nothing else — arbitrary user HTML must never travel the same door.

<!-- /schemd-section -->
