<!-- schemd-doc: id=overview; label=Quickstart; title=Start with schemd 0.3; summary=Compile rotated, multi-domain engineering diagrams into deterministic accessible SVG.; category=Get started; order=10 -->

`schemd` is pronounced like _“skemd”_ (`/skɛmd/`). Version 0.3 adds exact quarter-turn geometry and typed electrical, digital, quantum, and UML families while preserving the two-line language.

<!-- schemd-section: id=install; eyebrow=01 / Install; title=Compile on the server; example-title=Native RC low-pass filter -->

Install the exact release and compile without a DOM, Canvas, `getBBox()`, or browser layout:

```sh
npm install --save-exact @schemd/core@0.3.0
```

```ts
import { compileSchematic } from '@schemd/core';

const result = compileSchematic(source, {
	bounds: { width: 760, height: 430 },
	title: 'RC low-pass filter',
	mode: 'full'
});
```

The capacitor below is physically vertical: its vector, semantic ports, outward normals, collision rectangle, and routing corridors all rotate together.

```schemd bounds="760x430" title="Native RC low-pass filter"
source:VIN "V_{in}" at (80, 140) #blue [type=voltage-ac]
resistor:R1 "10 k\Omega" at (250, 140) #amber
junction:OUT "output node" at (420, 140) #cyan
capacitor:C1 "100 nF" at (420, 260) #cyan [orientation=down]
ground:GND "0 V" at (420, 360) #slate
port:LOAD "V_{out}" at (650, 140) #emerald

VIN.positive -> R1.in #blue [ortho]
VIN.negative -> GND.in #slate [line]
R1.out -> OUT.node #amber [line]
OUT.node -> C1.in #cyan [ortho]
C1.out -> GND.in #cyan [line]
OUT.node -> LOAD.in #emerald [line]
```

<!-- /schemd-section -->

<!-- schemd-section: id=migrate; eyebrow=02 / Migration; title=Move from 0.2.x deliberately; example-title=Legacy-compatible source -->

Existing declarations remain valid. Omitted `orientation` is byte-compatible with the canonical right-facing form when a stable `idPrefix` is supplied. New 0.3 syntax must not be copied into historical 0.2.x documents.

- Keep `in`, `out`, `left/l`, and `right/r` aliases where they already existed.
- Replace UML-pseudostate junction workarounds with `junction`.
- Replace horizontal shunt workarounds with `[orientation=down]` or `[orientation=up]`.
- Use explicit `[width=N]` for buses and bus-capable ports.

```schemd bounds="660x280" title="Legacy-compatible source"
port:IN "in" at (70, 120) #blue
resistor:R1 "R" at (260, 120) #amber
port:OUT "out" at (540, 120) #emerald
IN.out -> R1.in #blue [line]
R1.out -> OUT.in #emerald [line]
```

Continue with the [grammar](/docs/0.3.0/grammar), [component API](/docs/0.3.0/component-reference), [playground](/playground/0.3.0), and [release timeline](/changelog).

<!-- /schemd-section -->
