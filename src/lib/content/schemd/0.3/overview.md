<!-- schemd-doc: id=overview; label=Quickstart; title=Start with schemd 0.3; summary=Compile rotated, multi-domain engineering diagrams into deterministic accessible SVG.; category=Get started; order=10 -->

`schemd` is pronounced like _“skemd”_ (`/skɛmd/`). Version 0.3 adds exact quarter-turn geometry, first-class nets, and typed electrical, digital, quantum, and UML families — without changing the two-line language.

<!-- schemd-section: id=install; eyebrow=01 / Install; title=Compile on the server; example-title=Buck converter output stage; example-summary=A vertical catch diode and output capacitor rotated into place. -->

Install the compiler and hand it a string. No DOM, no Canvas, no `getBBox()`, no browser layout pass — so this runs during a build or inside a request handler.

```sh
npm i @schemd/core
```

```ts
import { compileSchematic } from '@schemd/core';

const result = compileSchematic(source, {
	bounds: { width: 900, height: 520 },
	title: 'Buck converter output stage',
	mode: 'full'
});
```

The converter beside this is the case quarter-turn geometry was added for. Both the catch diode and the output capacitor are physically vertical, and the rotation is total: the vector, the semantic ports, their outward normals, the collision rectangle, and the routing corridors all turn together. What does _not_ turn is the vocabulary — `D1.anode` is still the anode.

Because the topology is declared rather than drawn, we can read the design off it. The inductor current ripple over one switching period is

$$
\Delta I_L = \frac{(V_{in} - V_{out})\,D}{L\,f_{sw}}
$$

so with $L = 47\,\mu\text{H}$ at $f_{sw} = 500\ \text{kHz}$, a 12 V input at 50% duty gives roughly $128\ \text{mA}$ — which is what sizes the output capacitor.

```schemd bounds="900x520" title="Buck converter output stage"
source:VIN "V_{in}" at (90, 130) #blue [type=voltage-dc]
switch:SW "PWM" at (300, 130) #amber [type=spst]
junction:SWN "SW" at (470, 130) #cyan
inductor:L1 "47 \muH" at (640, 130) #purple
junction:OUTN "V_{out}" at (790, 130) #cyan
capacitor:C1 "220 \muF" at (790, 280) #cyan [orientation=down]
diode:D1 "catch" at (470, 280) #emerald [type=schottky orientation=up]
ground:GND "0 V" at (630, 420) #slate

VIN.positive -> SW.in #blue [line]
SW.out -> SWN.node #amber [line]
SWN.node -> L1.in #purple [line]
L1.out -> OUTN.node #purple [line]
OUTN.node -> C1.in #cyan [line]
C1.out -> GND.in #cyan [ortho]
SWN.node -> D1.cathode #emerald [line]
D1.anode -> GND.in #emerald [ortho]
VIN.negative -> GND.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=migrate; eyebrow=02 / Migration; title=Move from 0.2.x deliberately; example-title=Legacy-compatible divider; example-summary=A 0.2-era document that still compiles unchanged. -->

Existing declarations stay valid, and an omitted `orientation` is byte-compatible with the canonical right-facing form when a stable `idPrefix` is supplied. The reverse is not true: 0.3 syntax must not be pasted back into a historical 0.2.x document.

- Keep the `in`, `out`, `left`/`l`, and `right`/`r` aliases wherever they already worked.
- Replace UML-pseudostate junction workarounds with a real `junction`.
- Replace horizontal shunt workarounds with `[orientation=down]` or `[orientation=up]`.
- Give buses and bus-capable ports an explicit `[width=N]`.

```schemd bounds="720x300" title="Legacy-compatible divider"
port:IN "V_{in}" at (70, 140) #blue
resistor:RTOP "R_1" at (270, 140) #amber
resistor:RBOT "R_2" at (470, 140) #amber
port:TAP "V_{tap}" at (650, 140) #emerald

IN.out -> RTOP.in #blue [line]
RTOP.out -> RBOT.in #amber [line]
RBOT.out -> TAP.in #emerald [line marker-end=arrow]
```

Nothing there uses a 0.3 feature — no orientation, no net name, no width — which is the point: it compiles unchanged. Continue with the [grammar](/docs/0.3/grammar), the [component API](/docs/0.3/component-reference), the [playground](/playground/latest), or the [release timeline](/changelog).

<!-- /schemd-section -->
