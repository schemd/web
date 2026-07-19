# API Reference

Everything stable lives on the package root; deep entry points (`@schemd/core/parser`, `/renderer`, `/compiler`, `/layout`, `/math-label`, `/types`) exist for hosts that want to tree-shake a single stage. Node.js **24 or newer** is required; there is no browser build because there is nothing browser-shaped inside — no DOM, no `window`, no dependencies.

## compileSchematic

```ts
function compileSchematic(
  source: string,
  options: CompileSchematicOptions
): SchematicCompilation;
```

The one-pass facade: parse, then render, returning the validated `document`, the `svg` string, and a small metrics record — `sourceCharacters`, `components`, `connections`, and `svgBytes` (exact UTF-8). The metrics power this site's playground status bar and the changelog benchmarks.

`CompileSchematicOptions` extends the fence (`bounds`, `title`) with three optionals: `idPrefix` (sanitized definition namespace), `mode` (`'default' | 'embedded-css' | 'full'`), and `semanticHooks` (any subset of `['nodes', 'ports', 'wires']`, meaningful in `full` mode, defaulting to all three).

## parseSchematicFence

```ts
function parseSchematicFence(
  info: string | undefined,
  defaultTitle?: string
): SchematicFence | undefined;
```

Validates a Markdown fence information string — `schemd bounds="640x260" title="…"`. Returns `undefined` for other languages (so you can call it on every fence you meet), and throws `SchematicSyntaxError` for a recognized fence with malformed metadata. Bounds are integers from 64 through 4096; titles are capped at 512 characters. The legacy `schematic` identifier is accepted on input only.

## parseSchematic

```ts
function parseSchematic(source: string, fence: SchematicFence): SchematicDocument;
```

The full front end: bounded lexing, semantic validation, geometry checking, and route computation, returning a deeply frozen, renderer-authorized AST. Throws `SchematicSyntaxError` with a one-based `.line` for every deterministic failure.

## renderSchematic

```ts
function renderSchematic(
  document: SchematicDocument,
  options: CompileSchematicOptions
): string;
```

Serializes a parser-provenanced document to SVG through the byte-budgeted writer. Passing any other object — cloned, forged, or parsed by a different loaded copy of the package — raises a `TypeError`. Routes cached at parse time are reused when the bounds match, so parse-once-render-many hosts pay for routing exactly once.

## parseSchematicColor

```ts
function parseSchematicColor(input: string, line?: number): SchematicColor;
```

The color lexer, exported on its own because hosts writing tooling want it: returns `{ kind: 'token' | 'css' | 'alias', value }` or throws. Useful for validating theme configuration with exactly the compiler's rules.

## The math-label toolkit

`parseMathLabel` (segments with baseline metadata), `renderMathLabelTspans` (escaped `<tspan>` markup), `mathLabelText` (plain Unicode), `mathLabelGlyphLength`, and `mathLabelTextWidth` (the deterministic width metric layout uses). If you build an editor that must align with compiled output, use these rather than guessing.

## Layout internals (exported, engineering-grade)

For instrumented hosts, the layout stage is public: `routeConnections` / `routeConnection`, `componentRectangle` / `componentObstacleRectangle`, `enumerateComponentPorts`, `resolvePortPoint` / `resolvePortGeometry`, `positionIcPin`, `distributedCoordinate`, `classicalGateHeight`, `componentTextAnchors`, `validateDocumentGeometry`, plus the constants `PORT_HOTSPOT_RADIUS`, `SCHEMATIC_BRIDGE_RADIUS`, and `SCHEMATIC_OBSTACLE_CLEARANCE`. This site's playground uses the port enumeration to build its source↔vector hover mapping.

## Constants and types

The keyword registries (`COMPONENT_KINDS`, `PASSIVE_KINDS`, `ANALOG_KINDS`, `CLASSICAL_GATE_KINDS`, `QUANTUM_GATE_KINDS`, `UML_COMPONENT_KINDS`, `UML_RELATION_KINDS`, `SEMANTIC_COLORS`, `SCHEMATIC_SIGNAL_MARKERS`, `SCHEMD_OUTPUT_MODES`, `SCHEMD_SEMANTIC_HOOKS`, `GROUND_STYLES`, `DIODE_TYPES`, `TRANSISTOR_TYPES`) are exported as `const` tuples with matching union types, so exhaustive switches in your host code stay exhaustive at compile time. The limits appear both individually and as the frozen `SCHEMATIC_LIMITS` record. Every AST shape — `SchematicDocument`, `SchematicComponent`, `SchematicConnection`, `SchematicColor`, and the per-kind component interfaces — is importable with `import type` and never drags runtime code with it.

## SchematicSyntaxError

```ts
class SchematicSyntaxError extends Error {
  readonly line: number | undefined;
}
```

Located messages are prefixed `Line N:` exactly once by the constructor, so SSR, remote previews, and tests present identical diagnostics. Catch it, read `.line`, and point your editor at the problem — that is precisely what the playground on this site does.
