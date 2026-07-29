<!-- schemd-doc: id=overview; label=Quickstart; title=Make your first diagram; summary=Write a few lines of text and turn them into accessible, deterministic SVG for circuits or UML.; category=Get started; order=10 -->

<!-- schemd-section: id=direct-api; eyebrow=01 / Install; title=Compile text into SVG; example-title=Sensor input; example-summary=A small circuit compiled without a browser or DOM. -->

We treat a schematic the way a compiler treats source, so the first step is the one every compiler asks: install it, then hand it a string.

```sh
npm install @schemd/core
```

A `schemd` document is _bounded before it is parsed_. `parseSchematicFence` validates the fence header — the canvas dimensions and an accessible title — and `compileSchematic` walks the declarations into deterministic SVG:

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="640x260" title="Sensor input"')!;

const { svg, document, metrics } = compileSchematic(source, fence);
```

All of this runs on a server or during a build — no DOM, no font-loading pass, no layout library. The compiler reserves space from the bounds we declared, so the page never reflows once the vector lands.

Consider a sensor front-end: a source, a series resistor, a shunt capacitor to ground. The diagram beside this is not a _drawing_ of that network — it **is** that network, compiled. Because the topology is explicit, we can reason about it: the resistor and capacitor form a first-order low-pass filter with cutoff

$$
f_c = \frac{1}{2\pi R C}
$$

which, for $R = 10\,\text{k}\Omega$ and $C = 100\,\text{nF}$, lands near $f_c \approx 159\ \text{Hz}$.

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

Core ships no Markdown parser, and the omission is deliberate: the boundary between _parse my prose_ and _compile my diagrams_ belongs to us. Keep the parser on the server, recognize `schemd` fences, forward only the body.

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

function renderSchemdFence(body: string, info: string) {
	const fence = parseSchematicFence(info);
	if (!fence) return undefined;

	return compileSchematic(body, fence).svg;
}
```

Wire that one function into Marked, markdown-it, unified, or a build step of our own. This site uses exactly that boundary — not a byte of compiler or Markdown code reaches the browser. Note that the grammar which drew the circuit above also describes _structure_; below it holds a two-class model instead of a filter.

```schemd bounds="760x360" title="Tiny class model"
class:User "User" at (200, 180) #slate [attributes="- id: UUID; + email: string" operations="+ save(): void"]
class:Admin "Admin" at (560, 180) #blue [operations="+ suspend(user): void"]

Admin.left -> User.right #blue [ortho generalization]
```

<!-- /schemd-section -->
