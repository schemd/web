# The schemd Language

The grammar fits on an index card, and that is deliberate. There are exactly two kinds of declarations — components and connections — plus comments and blank lines. Everything else is options. In this chapter we work through each lexical shape precisely as the compiler's parser defines it.

## The fence

Every schematic begins life inside a fenced code block whose information string declares the canvas:

```text
schemd bounds="WIDTHxHEIGHT" title="Optional accessible title"
```

`parseSchematicFence` validates this string. The rules are strict, and each violation is a deterministic diagnostic:

- `bounds` is required. Width and height must be integers from **64 through 4096** — these become the SVG `viewBox` extents, reserved before paint.
- `title` is optional; when omitted, the host default (`"Engineering schematic"`) applies. Titles cannot be empty and cannot exceed **512 characters**. The title becomes the SVG's accessible `<title>`.
- The identifier is case-insensitive, and a fence for another language simply returns `undefined` — no error, no guessing.

## Component declarations

One component per line, in exactly this shape:

```text
kind:ID "label" at (x, y) color [options]
```

Let's take it token by token, because every token is validated:

- **`kind`** — one of the registered component keywords (see [Component Primitives](./components) and [UML Nodes](./uml)). Unknown kinds fail with `Unsupported component kind`.
- **`ID`** — matches `[A-Za-z][A-Za-z0-9_-]*` and must be unique in the document; duplicates are rejected at the line that repeats them. Connections address components by this ID.
- **`"label"`** — required, quoted, and passed through the micro-math pipeline (below).
- **`at (x, y)`** — decimal coordinates in canvas units. The origin must sit inside the declared bounds; the full vector extent is then checked again after layout, so a gate cannot hang off the edge of the canvas either.
- **`color`** — required for every kind except `ic`, which defaults to `slate`. Colors get their own section below.
- **`[options]`** — optional bracketed `key=value` pairs. Duplicate keys are rejected; keys not supported by the chosen kind are rejected by name.

## Connection declarations

A wire is a directed edge between two named terminals:

```text
ID.port -> ID.port color [options]
```

Both endpoints are validated after the whole document parses, so forward references work — you can wire to a component declared three lines later. An unknown component or an invalid port for that component's kind fails with the connection's line number.

Connection options are order-free tokens rather than only `key=value` pairs. The routing keywords `line`, `bezier`, and `ortho` select straight, cubic Bézier, or obstacle-aware orthogonal geometry; `dashed` and `solid` control the stroke pattern; a bare relation keyword such as `generalization` sets UML semantics; `arrow` and `dot` are shorthand for `marker-end`. The full matrix lives in [Connections & Routing](./connections).

```schemd bounds="640x220" title="Three routing strategies"
port:A "A" at (70, 60) #blue
port:B "B" at (560, 60) #blue
port:C "C" at (70, 160) #amber
port:D "D" at (560, 160) #amber
resistor:R1 "R" at (310, 110) #slate

A.out -> B.in #blue [line]
C.out -> R1.in #amber [ortho]
R1.out -> D.in #emerald [bezier arrow]
```

## Comments and whitespace

Lines beginning with `//` are comments; blank lines are skipped. Both survive round-trips through the playground's share links because the compiler never rewrites your source.

## Colors

The color token accepts three distinct families, each sanitized before it can reach the SVG:

| Family | Syntax | What the renderer emits |
| --- | --- | --- |
| Semantic token | `amber`, `blue`, `cyan`, `purple`, `slate`, `emerald` (a `#` prefix is allowed) | a stable theme class, `schematic-token--<name>` |
| CSS literal | `#0af`, `#00aaff`, 4- and 8-digit hex, `rgb()`, `rgba()`, `hsl()`, `hsla()` | the canonicalized color, inlined safely |
| Theme alias | any `[a-z][a-z0-9-]{0,63}` name, e.g. `signal-hot` | `var(--schematic-color-signal-hot, …)` |

Hex colors require exactly 3, 4, 6, or 8 digits. Functional colors accept both legacy comma syntax and modern space syntax, and are canonicalized to the modern form; malformed channels are rejected, not passed through. An important takeaway here is the alias family: an alias never becomes a literal color declaration. It resolves through a host-defined `--schematic-color-<alias>` custom property, which is how this site retints every diagram when you switch blueprint modes — the SVG never changes, only the CSS custom properties around it.

## Micro-math labels

Labels pass through a deliberately small, linear-time math grammar — not TeX, and proudly so. It recognizes three things:

- **Subscripts and superscripts** — `V_{in}` and `x^2`, with braces grouping multi-character shifts. Nesting is supported with proportional scaling.
- **Symbol commands** — a fixed allowlist translated to Unicode: `\alpha`, `\beta`, `\Delta`, `\cdot`, `\infty`, `\lambda`, `\le`, `\ge`, `\mu`, `\neq`, `\Omega`, `\omega`, `\phi`, `\pi`, `\pm`, `\rightarrow`, `\sigma`, `\sqrt`, `\theta`, `\times`. Unknown commands remain literal text — nothing is silently dropped.
- **Escapes** — `\\`, `\{`, `\}`, `\_`, `\^` produce the literal characters.

```schemd bounds="640x200" title="Micro-math in labels"
port:IN "V_{in}" at (70, 100) #blue
resistor:R1 "R_1 = 4.7 k\Omega" at (280, 100) #amber
capacitor:C1 "C \le 100 \mu F" at (490, 100) #cyan

IN.out -> R1.in #blue [ortho]
R1.out -> C1.in #amber [ortho]
```

<div class="admonition note">
<span class="title">Note: why not TeX?</span>
<p>A full math runtime would mean a dependency, a parser with pathological inputs, and non-deterministic layout. The micro-math grammar is bounded by the label's own length and cannot recurse — the same security posture as the rest of the compiler.</p>
</div>

## Errors are part of the language

Every failure is a `SchematicSyntaxError` whose message is prefixed with `Line N:` exactly once, and which carries a structured `.line` property. When you mistype a port, you get the port, the component, and its kind back: `Port R1.cathode is invalid for resistor.` We treat diagnostics as UI — the playground surfaces them verbatim, and the auditory feedback layer plays a distinct minor tone when one appears.
