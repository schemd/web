# Limits & Security Model

A compiler that accepts author-controlled text and emits markup is a security boundary, and `@schemd/core` treats itself as one. The posture is simple to state: **every allocation has a ceiling, every string is validated before it can reach the SVG, and the renderer refuses input it cannot prove came from the parser.** Let's unpack each clause.

## The hard budgets

Five ceilings are enforced per compilation pass, exported both as individual constants and as the frozen `SCHEMATIC_LIMITS` record so hosts can display them (this table is rendered from those very exports):

| Budget | Constant | Value |
| --- | --- | --- |
| Source characters (UTF-16) | `MAX_SCHEMATIC_SOURCE_CHARACTERS` | 131,072 |
| Components per document | `MAX_SCHEMATIC_COMPONENTS` | 512 |
| Connections per document | `MAX_SCHEMATIC_CONNECTIONS` | 2,048 |
| Rendered wire crossings | `MAX_SCHEMATIC_WIRE_CROSSINGS` | 32,768 |
| SVG output bytes (UTF-8) | `MAX_SCHEMATIC_SVG_OUTPUT_BYTES` | 2,097,152 |

The output ceiling deserves a closer look. The renderer writes through a `BoundedSvgWriter` that tracks the exact UTF-8 byte cost of every appended fragment incrementally — including four-byte astral code points — and throws before an oversized document can be joined. Partial oversized output is never returned.

## The provenance boundary

`parseSchematic` deep-freezes every reachable structure of the AST — components, connections, colors, pin lists, compartment rows — and registers the frozen document in a private `WeakSet`. `renderSchematic` then asserts membership before touching anything:

```ts
renderSchematic(forgedDocument, options);
// TypeError: renderSchematic requires an immutable document
// returned by parseSchematic.
```

Why so strict? Because the renderer's escaping and geometry assumptions are proven against the parser's validation. An object graph you assembled by hand — or mutated after parsing — voids those proofs, so it is rejected as a type error, not rendered on a best-effort basis. The `WeakSet` costs nothing at steady state: when your document is garbage-collected, its registration goes with it.

## Sanitization before markup

Nothing author-controlled is interpolated raw:

- **Colors** are parsed into a discriminated union — semantic token, canonicalized CSS literal, or alias — and aliases become `var(--schematic-color-…)` references, never literal declarations. Unsafe expressions fail with `Unsafe or unsupported color expression.`
- **Labels, pin names, titles** are XML-escaped at the writer boundary.
- **IDs and the `idPrefix` option** are pattern-validated, so definition references cannot be forged.
- **Numeric attributes** (counts, dimensions, coordinates) are pattern-checked and range-checked before `Number()` conversion — `1e999` never becomes geometry.

## Determinism as a security property

Byte-identical output for identical input is not only pleasant for caching — it makes the compiler auditable. There is no randomness, no clock, no locale dependence (byte sizes are formatted with an explicit locale in diagnostics), and no environment probing anywhere in the pipeline. If a rendered document differs between two machines, one of the inputs differed. Full stop.

<div class="admonition note">
<span class="title">Note: what schemd does not sandbox</span>
<p>Core emits static SVG — it contains no scripts and no event handlers, in any mode. Interactivity in <code>full</code> mode is data attributes and CSS classes only; the JavaScript that reacts to them is always yours, running under your CSP, at the host boundary.</p>
</div>
