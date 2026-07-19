<!-- schemd-doc: id=markdown-adapters; label=Markdown pipelines; title=Add Schemd to a Markdown pipeline; summary=Handle only schemd fences and leave every other token to the host parser.; category=Connect toolchains; order=90 -->

<!-- schemd-section: id=adapter-contract; eyebrow=01 / Adapter; title=Keep the compiler boundary small; example-title=Adapter test circuit; example-summary=A portable fixture for checking any Markdown adapter. -->

Schemd is parser-free, and a good adapter keeps it that way. It has exactly two responsibilities — recognize the fence, and compile it — and everything past those two lines is someone else's problem, which is how it should be.

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

export function renderSchemdFence(body: string, info: string) {
	const fence = parseSchematicFence(info);
	return fence ? compileSchematic(body, fence).svg : undefined;
}
```

Recognize only the `schemd` language; hand every other fence straight back to the host parser. Emit the compiled SVG as trusted HTML on the server — and, as everywhere else in this documentation, keep arbitrary HTML well off that path.

```schemd bounds="720x300" title="Adapter test circuit"
port:IN "Input" at (60, 150) #blue
diode:D1 "Protection" at (360, 150) #cyan [type=zener]
port:OUT "Output" at (660, 150) #emerald

IN.out -> D1.anode #blue [line]
D1.cathode -> OUT.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->
