<!-- schemd-doc: id=overview; label=Quickstart; title=Make your first diagram; summary=Write a few lines of text and turn them into accessible SVG for circuits or UML.; category=Get started; order=10 -->

<!-- schemd-section: id=direct-api; eyebrow=01 / Install; title=Compile text into SVG; example-title=Sensor input; example-summary=A small circuit compiled without a browser or DOM. -->

Install the core package:

```sh
npm install @schemd/core
```

Compile a bounded document:

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="640x260" title="Sensor input"')!;

const { svg, document, metrics } = compileSchematic(source, fence);
```

Schemd runs on a server or during a build. It does not need a DOM, a font-loading pass, or a client-side layout library.

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

<!-- schemd-section: id=markdown; eyebrow=02 / Markdown; title=Keep Markdown in your app; example-title=Tiny class model; example-summary=The same text format also covers UML nodes and relationships. -->

Core does not ship a Markdown parser. Keep your parser on the server, recognize `schemd` fences, and send the fence body to the compiler.

```sh
npm install @schemd/core
```

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

function renderSchemdFence(body: string, info: string) {
	const fence = parseSchematicFence(info);
	if (!fence) return undefined;

	return compileSchematic(body, fence).svg;
}
```

Use that function from Marked, markdown-it, unified, or your own build pipeline. The website uses this exact server-only boundary, so no compiler or Markdown code reaches the browser.

```schemd bounds="760x360" title="Tiny class model"
class:User "User" at (200, 180) #slate [attributes="- id: UUID; + email: string" operations="+ save(): void"]
class:Admin "Admin" at (560, 180) #blue [operations="+ suspend(user): void"]

Admin.left -> User.right #blue [ortho generalization]
```

<!-- /schemd-section -->
