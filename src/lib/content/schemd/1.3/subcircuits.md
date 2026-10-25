<!-- schemd-doc: id=subcircuits; label=Sub-circuits; title=Write a block once and place it many times; summary=Define reusable sub-circuits with parameters and exposed terminals, nest them, and know exactly what they lower to.; category=Author diagrams; order=27 -->

<!-- schemd-section: id=blocks; eyebrow=01 / Blocks; title=Define a block, then place copies of it; example-title=Two LC stages; example-summary=One definition, placed twice with different values, wired through the terminals it exposes. -->

Real schematics repeat themselves. A filter has two identical stages, and a board may carry four identical bypass networks. When each copy is written out by hand, a fix tends to land in one copy and miss the others.

A sub-circuit is a block written once:

```text
subcircuit NAME [parameters] {
  …ordinary declarations…
  expose TERMINAL = PART.port
}
```

It is then placed by name, as often as needed:

```text
NAME:ID at (x, y) [name=value]
```

Inside the braces is the same language as everywhere else: components, connections, relative placement and comments. Coordinates written with `at (x, y)` are relative to the block's own origin, and the position of the instance moves the whole block. An instance has no label or colour of its own, because it is a placement and not a part.

```schemd bounds="900x540" title="Two LC stages"
subcircuit lc [l="10 \mu H" c="100 nF"] {
  inductor:L "{{l}}" at (0, 0) #purple
  junction:N right-of L by 50 #cyan
  capacitor:C "{{c}}" below N by 50 aligned-x with N #cyan [orientation=down]
  L.out -> N.node #purple [ortho]
  N.node -> C.in #cyan [ortho]
  expose in = L.in
  expose out = N.node
  expose gnd = C.out
}

source:SW "V_{sw}" at (90, 160) #blue [type=voltage-pulse]
lc:F1 at (260, 160)
lc:F2 at (540, 160) [l="4.7 \mu H" c="47 nF"]
port:VF "V_{f}" at (820, 160) #emerald
ground:GND "0 V" at (420, 450) #slate

SW.positive -> F1.in #blue [ortho]
F1.out -> F2.in #cyan [ortho]
F2.out -> VF.in #emerald [ortho]
SW.negative -> GND.in #slate [ortho]
F1.gnd -> GND.in #slate [ortho]
F2.gnd -> GND.in #slate [ortho]
```

Outside the block, `L` and `C` are never addressed directly. The wire goes to `F1.out`, a terminal the definition chose to expose, and the compiler resolves it to the inner terminal it names. Hence the inside of a block can be rearranged without touching a single connection that uses it. The junction `N` carries no label, so each copy shows only its designator, `F1_N` or `F2_N`.

<!-- /schemd-section -->

<!-- schemd-section: id=parameters; eyebrow=02 / Parameters; title=Vary each copy with parameters; example-title=Fused lamp bank; example-summary=One fuse-and-lamp block, three colours, three fuse ratings. -->

A block's header declares the parameters an instance may set. Each parameter either has a default, such as `fuse="1 A"`, or is bare. A bare parameter is required: every instance must set it, or the compile fails and names the instance and the parameter.

Inside the block, `{{name}}` is replaced by the instance's value anywhere on a line, whether in a label, a colour or an option. The double braces are deliberate, so a math label such as `V_{out}` is never mistaken for a parameter.

```text
load:L "{{name}}" right-of F by 70 #{{tone}} [type=lamp]
```

Values follow the rules of connection options. `tone=amber` needs no quotes, and anything with a space does. An unknown parameter is a compile error on the line that caused it. So is a parameter set twice, and so is a `{{placeholder}}` that the header never declared.

```schemd bounds="760x500" title="Fused lamp bank"
subcircuit lamp [name tone fuse="1 A"] {
  protection:F "{{fuse}}" at (0, 0) #amber [type=fuse]
  load:L "{{name}}" right-of F by 70 #{{tone}} [type=lamp]
  F.out -> L.in #{{tone}} [ortho]
  expose a = F.in
  expose k = L.out
}

port:V12 "12 V" at (90, 100) #blue
lamp:K1 at (260, 100) [name=cabin tone=amber fuse="2 A"]
lamp:K2 at (260, 220) [name=deck tone=cyan]
lamp:K3 at (260, 340) [name=warning tone=rose fuse="500 mA"]
ground:GND "0 V" at (660, 420) #slate

V12.out -> K1.a #blue [ortho]
V12.out -> K2.a #blue [ortho]
V12.out -> K3.a #blue [ortho]
K1.k -> GND.in #slate [ortho]
K2.k -> GND.in #slate [ortho]
K3.k -> GND.in #slate [ortho]
```

The three fuses differ because the three lamps draw different currents. That is exactly the kind of difference a parameter should carry: the structure is shared and the values are not.

<!-- /schemd-section -->

<!-- schemd-section: id=nesting; eyebrow=03 / Nesting; title=Build blocks out of blocks; example-title=Two-pole LC filter from nested stages; example-summary=A two-pole block made of two one-pole blocks, with parameters passed straight through. -->

A block may place other blocks, so a two-pole LC filter can be written as two one-pole stages in place of four parts. Parameters pass through by placeholder. `lc:A at (0, 0) [l="{{l}}" c="{{c1}}"]` hands the outer instance's values to the inner one. An exposed terminal may also name a terminal of a nested instance, and the compiler follows it down through every level.

```schemd bounds="960x540" title="Two-pole LC filter from nested stages"
subcircuit lc [l c] {
  inductor:L "{{l}}" at (0, 0) #purple
  junction:N right-of L by 50 #cyan
  capacitor:C "{{c}}" below N by 50 aligned-x with N #cyan [orientation=down]
  L.out -> N.node #purple [ortho]
  N.node -> C.in #cyan [ortho]
  expose in = L.in
  expose out = N.node
  expose gnd = C.out
}

subcircuit pair [c1 c2 l="22 \mu H"] {
  lc:A at (0, 0) [l="{{l}}" c="{{c1}}"]
  lc:B at (290, 0) [l="{{l}}" c="{{c2}}"]
  A.out -> B.in #cyan [ortho]
  expose in = A.in
  expose out = B.out
  expose ga = A.gnd
  expose gb = B.gnd
}

source:PWM "V_{pwm}" at (90, 160) #blue [type=voltage-pulse]
pair:F at (250, 160) [c1="220 nF" c2="22 nF"]
port:VDC "V_{dc}" at (870, 160) #emerald
ground:GND "0 V" at (400, 450) #slate

PWM.positive -> F.in #blue [ortho]
F.out -> VDC.in #emerald [ortho]
PWM.negative -> GND.in #slate [ortho]
F.ga -> GND.in #slate [ortho]
F.gb -> GND.in #slate [ortho]
```

A block that contains itself, directly or through a chain of others, is refused, and the diagnostic names the chain: `Subcircuit a contains itself through a -> b -> a`.

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=04 / Lowering; title=Know exactly what a block becomes; example-title=Strap pull-downs; example-summary=Two copies of one pull-down block, which lower to parts named PD_RST_R and PD_BOOT_R. -->

A sub-circuit is no new kind of object. Like [relative placement](/docs/1.3/placement), it is lowered to declarations the compiler already understands before anything else reads the document. Every later pass therefore sees an ordinary flat document, from validation and routing to the netlist, the renderer and the source map. The lowering rules are worth knowing precisely, because they are what appears in the output.

- Each inner ID is prefixed with the instance ID and the character `_`. `PD_RST` places `R` as `PD_RST_R`, and a nested instance adds a level, as in `F_A_L`. Those are the IDs carried by the netlist, the SVG's `data-node-id` and the designators.
- Positions are offset. An inner `at (x, y)` moves by the instance's position, and an inner relation is pointed at the prefixed IDs.
- Lines are kept. A copied declaration keeps the line of the definition that wrote it. A diagnostic about a body declaration points at that declaration, and the source map sends every copy of `R` to the one line that declares it.
- A block reaches only its own parts. Every ID inside the braces is prefixed, so a reference out of the block names a part that does not exist. Blocks cannot depend on their surroundings without saying so.
- Expansion is budgeted. The expanded declarations count against the same [`sourceCharacters`](/docs/1.3/limits) limit as the source. An instance is shorthand for the parts it stands for, and without a ceiling three levels of eight instances would turn fourteen lines into 512 parts.
- A block that is never placed is an error. The same holds for a block that would shadow a built-in kind, a duplicate definition, a block left unclosed, `expose` outside a block, and an ID shared by an instance and a part.

```schemd bounds="780x520" title="Strap pull-downs"
subcircuit pulldown {
  resistor:R "100 k\Omega" at (0, 0) #amber [orientation=down]
  expose line = R.in
  expose rail = R.out
}

port:RSTN "RESET" at (90, 110) #cyan
port:BOOT "BOOT" at (90, 210) #violet
port:MCU_R "to MCU" at (680, 110) #cyan
port:MCU_B "to MCU" at (680, 210) #violet
pulldown:PD_RST at (330, 300)
pulldown:PD_BOOT at (480, 300)
ground:GND "0 V" at (400, 450) #slate

RSTN.out -> MCU_R.in #cyan [ortho]
BOOT.out -> MCU_B.in #violet [ortho]
PD_RST.line -> MCU_R.in #cyan [ortho]
PD_BOOT.line -> MCU_B.in #violet [ortho]
PD_RST.rail -> GND.in #slate [ortho]
PD_BOOT.rail -> GND.in #slate [ortho]
```

[`parseSchematicSvg`](/docs/1.3/reading-back) reads a compiled sub-circuit back as its flattened parts. Nothing in the SVG records which parts came from which block, and the decompiler does not guess.

<!-- /schemd-section -->
