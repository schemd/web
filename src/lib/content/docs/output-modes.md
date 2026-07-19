# Output Modes & Theming

One AST, three output budgets. The modes share **identical geometry** — switching modes never moves a single coordinate — and differ only in how much styling and interactivity travels inside the SVG itself. Choosing well is the difference between a 30-line static figure and an instrumented surface you can wire a simulator to.

## The three modes

`compileSchematic(source, { …fence, mode })` accepts exactly three values, validated at the renderer boundary:

| Mode | Adds | Reach for it when |
| --- | --- | --- |
| `default` | nothing — compact, static markup | articles, READMEs, anywhere bytes matter |
| `embedded-css` | one embedded `<style>` block: theme-aware token styles, hover/focus/state-class rules, glow layers, reduced-motion guards | interactive documents that theme via CSS custom properties |
| `full` | everything above, plus focusable component groups, invisible port hotspots, and delegated-interaction `data-*` attributes | playgrounds, simulators, editor tooling |

An invalid mode is rejected with `Render mode must be one of: default, embedded-css, or full.` — the options boundary is validated like any other untrusted input.

## What `full` mode emits

Full mode is what powers this site's simulation laboratory. Three families of semantic payloads are controlled by the `semanticHooks` option — an array drawn from `nodes`, `ports`, and `wires`, defaulting to all three:

- **`nodes`** — each component group carries `data-node-id`, `data-node-kind`, and `data-node-label`, is keyboard-focusable, and owns a glow layer that activates on hover, focus, or the `is-active`/`is-selected`/`is-hovered` state classes.
- **`ports`** — every terminal gets an invisible hotspot circle with `data-port-id` and `data-parent-node`, sized for touch and focus-visible for keyboards.
- **`wires`** — every connection group carries `data-wire-source` and `data-wire-target` endpoint addresses.

The intended pattern is **event delegation on the root SVG container**: one listener, constant memory, and the compiler's attributes tell you exactly what was touched. Add `is-active` to make a wire glow; add `is-degraded` to dim a faulted branch — the state classes and their transitions ship inside the SVG's embedded styles.

```schemd bounds="640x220" title="A full-mode surface (hover the parts)"
port:IN "Pulse" at (80, 110) #blue
nand:N1 "N1" at (300, 110) #cyan
port:OUT "Q" at (540, 110) #emerald

IN.out -> N1.in1 #blue [ortho]
N1.out -> OUT.in #cyan [ortho arrow]
```

## The custom-property contract

Theming never requires recompilation. The renderer routes every paint decision through CSS custom properties with sensible fallbacks:

| Property | Controls |
| --- | --- |
| `--schematic-vector` | the active stroke/fill color of a token group |
| `--schematic-vector-fallback` | fallback vector color when no token or alias resolves |
| `--schematic-surface` | halo color behind connector labels; interior of hollow UML markers |
| `--schematic-grid` | the optional background grid stroke |
| `--schematic-stroke-width` / `--schematic-interactive-stroke-width` | resting and hover/focus stroke weights |
| `--schematic-color-<alias>` | resolution target for every alias color you invent |

Semantic tokens emit stable classes (`schematic-token--amber` and friends) that the host styles; alias colors resolve through `var(--schematic-color-<alias>, …)` chains and never inject literal author CSS. This is precisely how the blueprint switcher on this site retints every compiled diagram instantly — the SVG strings are immutable; only the custom properties change.

## The `idPrefix` option

SVG `<defs>` collide when two diagrams share a page. `idPrefix` namespaces every marker and symbol definition; the value is sanitized before use. Every diagram on this page carries its own prefix — that is why eight compiled figures coexist in one document without a single duplicate-ID warning.

<div class="admonition note">
<span class="title">Note: accessibility is not a mode</span>
<p>Every mode — including <code>default</code> — emits the accessible <code>&lt;title&gt;</code> from your fence and keeps text as real <code>&lt;text&gt;</code> elements, never paths. Screen readers get words in all three budgets.</p>
</div>
