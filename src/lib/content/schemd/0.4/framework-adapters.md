<!-- schemd-doc: id=framework-adapters; label=UI frameworks; title=Keep the compiler at a trusted server boundary; summary=Render one deterministic SVG string in Svelte, React, Vue, Angular, or a build pipeline.; category=Connect toolchains; order=80 -->

<!-- schemd-section: id=server-boundary; eyebrow=01 / Host; title=Compile outside reactive component state; example-title=Framework-neutral source -->

The adapter contract is intentionally small: accept source plus a validated fence, call `compileSchematic`, then mount the trusted result. Do not import a DOM implementation or regenerate output when unrelated UI state changes.

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
connector:IN "input" at (80, 130) #blue
amplifier:A "op-amp" at (340, 130) #cyan [type=opamp]
connector:OUT "output" at (650, 130) #emerald
IN.out -> A.positive #blue [line]
A.out -> OUT.in #emerald [line]
```

Svelte should derive the SVG only from source/fence inputs. React should memoize on those same values. Vue and Angular should treat the result as trusted server output, never arbitrary user HTML.

<!-- /schemd-section -->
