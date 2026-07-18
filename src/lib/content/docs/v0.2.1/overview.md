<!-- schemd-doc: id=overview; label=Quickstart; title=Compile your first diagram; summary=Install @schemd/core, define a bounded document, and emit accessible SVG in one call.; category=Get started; order=10 -->

<!-- schemd-section: id=install; eyebrow=01 / Install; title=Add the zero-dependency compiler -->

Bun is used for Schemd itself. The package works with the package manager already in your project.

```sh
bun add @schemd/core
```

The published package requires Node.js 24 or newer. It has no runtime dependencies and does not require a DOM.

| Package manager | Command |
| --- | --- |
| Bun | `bun add @schemd/core` |
| npm | `npm install @schemd/core` |
| pnpm | `pnpm add @schemd/core` |
| Yarn | `yarn add @schemd/core` |

<!-- /schemd-section -->

<!-- schemd-section: id=direct-api; eyebrow=02 / Compile; title=Turn a bounded source into SVG -->

Import the compiler and fence parser from the package entry point. A fence defines the intrinsic SVG coordinate system and its accessible title.

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence(
	'schemd bounds="720x300" title="Sensor input"'
);

const { svg, document, metrics } = compileSchematic(source, fence);
```

The return value includes the trusted SVG string, the immutable parsed document, and counts for source characters, components, connections, and SVG bytes.

```schemd bounds="720x300" title="Sensor input"
port:VIN "Sensor" at (60, 150) #blue
resistor:R1 "10 k\Omega" at (245, 150) #amber
capacitor:C1 "100 nF" at (455, 150) #cyan
port:ADC "ADC" at (660, 150) #emerald

VIN.out -> R1.in #blue [line]
R1.out -> C1.in #amber [ortho]
C1.out -> ADC.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=host-boundary; eyebrow=03 / Host; title=Keep Markdown and UI concerns outside core -->

Schemd compiles its own diagram language. It deliberately does not parse Markdown, mount components, fetch remote content, or perform browser layout.

> Detect `schemd` fences in your server-side Markdown renderer, compile their bodies, and pass every other token back to the host parser.

Compile stable documents during a build or on the server. Interactive editors can use the same API in a worker, as the [versioned playground](/playground/v0.2.1) does.

<!-- /schemd-section -->
