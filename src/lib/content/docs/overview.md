# Overview

For decades, engineering schematics have mostly been drawn by hand — dragged, nudged, and aligned inside heavyweight editors, then exported as pixels that blur the moment you zoom. `schemd` (pronounced like _"skemd"_, /skɛmd/) takes a different position: a schematic is a small, precise text program, and a compiler — not a canvas — should turn it into vectors. You write declarations; `@schemd/core` parses them, validates the geometry, routes the wires around obstacles, and emits deterministic, accessible SVG. Same input, same output, every single time.

In this documentation, we'll be introduced to the whole system from the fence grammar, component primitives, and connection routing to output modes and the compiler's security model. We will use worked examples throughout — every diagram you see here was compiled by the real engine at load time, not illustrated by hand. This is to really understand the language, not just admire it.

## Why a compiler

A schematic drawn in a GUI encodes decisions nobody can diff. A schematic written as text can live in version control, render identically on a server, and be reviewed line by line like any other source file. `@schemd/core` leans into this fully:

- **Zero runtime dependencies.** The published package imports nothing at runtime. No DOM, no browser layout pass, no Markdown parser.
- **Deterministic.** Parsing is synchronous and ordered; components and connections keep their source order, and diagnostics carry exact one-based line numbers.
- **Bounded.** Every allocation has a ceiling — source length, component count, connection count, wire crossings, and output bytes are all hard limits the compiler enforces itself.
- **Server-first.** The compiler runs during a build or on a long-lived Node.js server (Node 24+). This site compiles every diagram you're reading server-side.

## Your first schematic

The DSL is intentionally small. A component is one line; a wire is one line. Here is a sensor input stage — three components, two orthogonally routed traces:

```schemd bounds="640x240" title="Sensor input stage"
port:VIN "Input" at (60, 120) #blue
resistor:R1 "10 k\Omega" at (250, 120) #amber
capacitor:C1 "100 nF" at (450, 120) #cyan

VIN.out -> R1.in #blue [ortho]
R1.out -> C1.in #amber [ortho]
```

Read the declarations aloud and the grammar explains itself: a `port` named `VIN`, labelled "Input", positioned at coordinates (60, 120), painted with the semantic `blue` token. Then a wire from `VIN`'s `out` terminal to `R1`'s `in` terminal. The `\Omega` in the resistor label is not TeX — it is `schemd`'s bounded micro-math syntax, translated to Ω by a fixed symbol table.

## The compilation pipeline

A curious mind would like to know what happens between text and vectors. Three passes, each with a stable public entry point:

- **Parse** — `parseSchematic(source, fence)` tokenizes each line against the component and connection grammars, validates colors, ports, options, and geometry, then returns a deeply frozen AST. The parser records each document in a private provenance registry, so forged object graphs can never reach the renderer.
- **Layout** — port positions, obstacle rectangles, and orthogonal routes are computed deterministically. Routes are validated at parse time and cached against the document, so rendering never re-routes.
- **Render** — `renderSchematic(document, options)` serializes the AST through a UTF-8 byte-budgeted writer into one self-describing markup string: a `<figure>`-wrapped `<svg>` carrying an accessible `<title>`, `<desc>`, and `<figcaption>`, in your choice of three output modes.

One facade wraps all three when you don't need the stages separately:

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="640x240" title="Sensor input"')!;
const { svg, document, metrics } = compileSchematic(source, fence);
// metrics → { sourceCharacters, components, connections, svgBytes }
```

## Where Markdown fits

Markdown belongs at the host boundary. Core does not ship a Markdown parser — your server-side renderer detects fenced `schemd` code blocks, hands their text to `compileSchematic`, and embeds the returned SVG. The fence information string carries the intrinsic bounds, which means layout space is reserved before a single byte of SVG arrives: zero layout shift, by construction.

<div class="admonition note">
<span class="title">Note: legacy fences</span>
<p>The legacy <code>schematic</code> fence identifier remains an input-only alias so previously persisted articles continue to render. Documentation and generated source always use <code>schemd</code>.</p>
</div>

## What's next

Continue to [The schemd Language](./language) for the complete grammar, or jump straight into the playground and start typing — the compiler will meet you there with line-numbered diagnostics. It'll be fun!
