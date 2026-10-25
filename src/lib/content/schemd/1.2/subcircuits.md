<!-- schemd-doc: id=subcircuits; label=Sub-circuits; title=Write a block once and place it many times; summary=Define reusable sub-circuits with parameters and exposed terminals, nest them, and know exactly what they lower to.; category=Author diagrams; order=27 -->

<!-- schemd-section: id=blocks; eyebrow=01 / Blocks; title=Define a block, then place copies of it; example-title=Two high-pass stages; example-summary=One definition, placed twice with different values, wired through the terminals it exposes. -->

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

```schemd bounds="900x540" title="Two high-pass stages"
subcircuit hp [c="100 nF" r="10 k\Omega"] {
  capacitor:C "{{c}}" at (0, 0) #cyan
  junction:N right-of C by 50 #cyan
  resistor:R "{{r}}" below N by 50 aligned-x with N #amber [orientation=down]
  C.out -> N.node #cyan [ortho]
  N.node -> R.in #amber [ortho]
  expose in = C.in
  expose out = N.node
  expose gnd = R.out
}

source:MIC "V_{mic}" at (90, 160) #blue [type=voltage-ac]
hp:H1 at (260, 160)
hp:H2 at (540, 160) [c="47 nF" r="22 k\Omega"]
port:VHP "V_{hp}" at (820, 160) #emerald
ground:GND "0 V" at (420, 450) #slate

MIC.positive -> H1.in #blue [ortho]
H1.out -> H2.in #cyan [ortho]
H2.out -> VHP.in #emerald [ortho]
MIC.negative -> GND.in #slate [ortho]
H1.gnd -> GND.in #slate [ortho]
H2.gnd -> GND.in #slate [ortho]
```

Outside the block, `C` and `R` are never addressed directly. The wire goes to `H1.out`, a terminal the definition chose to expose, and the compiler resolves it to the inner terminal it names. Hence the inside of a block can be rearranged without touching a single connection that uses it. The junction `N` carries no label, so each copy shows only its designator, `H1_N` or `H2_N`.

<!-- /schemd-section -->

<!-- schemd-section: id=parameters; eyebrow=02 / Parameters; title=Vary each copy with parameters; example-title=Status LED bank; example-summary=One LED-and-resistor block, three colours, three current-limiting values. -->

A block's header declares the parameters an instance may set. Each parameter either has a default, such as `r="330 \Omega"`, or is bare. A bare parameter is required: every instance must set it, or the compile fails and names the instance and the parameter.

Inside the block, `{{name}}` is replaced by the instance's value anywhere on a line, whether in a label, a colour or an option. The double braces are deliberate, so a math label such as `V_{out}` is never mistaken for a parameter.

```text
diode:D "{{name}}" right-of R by 70 #{{tone}} [type=led]
```

Values follow the rules of connection options. `tone=amber` needs no quotes, and anything with a space does. An unknown parameter is a compile error on the line that caused it. So is a parameter set twice, and so is a `{{placeholder}}` that the header never declared.

```schemd bounds="760x500" title="Status LED bank"
subcircuit led [name tone r="330 \Omega"] {
  resistor:R "{{r}}" at (0, 0) #amber
  diode:D "{{name}}" right-of R by 70 #{{tone}} [type=led]
  R.out -> D.anode #{{tone}} [ortho]
  expose a = R.in
  expose k = D.cathode
}

port:V3 "3.3 V" at (90, 100) #blue
led:S1 at (260, 100) [name=power tone=emerald r="150 \Omega"]
led:S2 at (260, 220) [name=link tone=cyan r="100 \Omega"]
led:S3 at (260, 340) [name=error tone=rose]
ground:GND "0 V" at (660, 420) #slate

V3.out -> S1.a #blue [ortho]
V3.out -> S2.a #blue [ortho]
V3.out -> S3.a #blue [ortho]
S1.k -> GND.in #slate [ortho]
S2.k -> GND.in #slate [ortho]
S3.k -> GND.in #slate [ortho]
```

The three current-limiting resistors differ because the forward voltages of the LEDs differ. That is exactly the kind of difference a parameter should carry: the structure is shared and the values are not.

<!-- /schemd-section -->

<!-- schemd-section: id=nesting; eyebrow=03 / Nesting; title=Build blocks out of blocks; example-title=Two-pole high-pass from nested stages; example-summary=A two-pole block made of two one-pole blocks, with parameters passed straight through. -->

A block may place other blocks, so a two-pole high-pass can be written as two one-pole stages in place of four parts. Parameters pass through by placeholder. `hp:A at (0, 0) [c="{{c}}" r="{{r1}}"]` hands the outer instance's values to the inner one. An exposed terminal may also name a terminal of a nested instance, and the compiler follows it down through every level.

```schemd bounds="960x540" title="Two-pole high-pass from nested stages"
subcircuit hp [c r] {
  capacitor:C "{{c}}" at (0, 0) #cyan
  junction:N right-of C by 50 #cyan
  resistor:R "{{r}}" below N by 50 aligned-x with N #amber [orientation=down]
  C.out -> N.node #cyan [ortho]
  N.node -> R.in #amber [ortho]
  expose in = C.in
  expose out = N.node
  expose gnd = R.out
}

subcircuit pair [r1 r2 c="10 nF"] {
  hp:A at (0, 0) [c="{{c}}" r="{{r1}}"]
  hp:B at (290, 0) [c="{{c}}" r="{{r2}}"]
  A.out -> B.in #cyan [ortho]
  expose in = A.in
  expose out = B.out
  expose ga = A.gnd
  expose gb = B.gnd
}

source:PU "V_{pickup}" at (90, 160) #blue [type=voltage-ac]
pair:F at (250, 160) [r1="15 k\Omega" r2="150 k\Omega"]
port:VCR "V_{cr}" at (870, 160) #emerald
ground:GND "0 V" at (400, 450) #slate

PU.positive -> F.in #blue [ortho]
F.out -> VCR.in #emerald [ortho]
PU.negative -> GND.in #slate [ortho]
F.ga -> GND.in #slate [ortho]
F.gb -> GND.in #slate [ortho]
```

A block that contains itself, directly or through a chain of others, is refused, and the diagnostic names the chain: `Subcircuit a contains itself through a -> b -> a`.

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=04 / Lowering; title=Know exactly what a block becomes; example-title=Chip-select pull-ups; example-summary=Two copies of one pull-up block, which lower to parts named PU_CS0_R and PU_CS1_R. -->

A sub-circuit is no new kind of object. Like [relative placement](/docs/1.2/placement), it is lowered to declarations the compiler already understands before anything else reads the document. Every later pass therefore sees an ordinary flat document, from validation and routing to the netlist, the renderer and the source map. The lowering rules are worth knowing precisely, because they are what appears in the output.

- Each inner ID is prefixed with the instance ID and the character `_`. `PU_CS0` places `R` as `PU_CS0_R`, and a nested instance adds a level, as in `F_A_R`. Those are the IDs carried by the netlist, the SVG's `data-node-id` and the designators.
- Positions are offset. An inner `at (x, y)` moves by the instance's position, and an inner relation is pointed at the prefixed IDs.
- Lines are kept. A copied declaration keeps the line of the definition that wrote it. A diagnostic about a body declaration points at that declaration, and the source map sends every copy of `R` to the one line that declares it.
- A block reaches only its own parts. Every ID inside the braces is prefixed, so a reference out of the block names a part that does not exist. Blocks cannot depend on their surroundings without saying so.
- Expansion is budgeted. The expanded declarations count against the same [`sourceCharacters`](/docs/1.2/limits) limit as the source. An instance is shorthand for the parts it stands for, and without a ceiling three levels of eight instances would turn fourteen lines into 512 parts.
- A block that is never placed is an error. The same holds for a block that would shadow a built-in kind, a duplicate definition, a block left unclosed, `expose` outside a block, and an ID shared by an instance and a part.

```schemd bounds="760x500" title="Chip-select pull-ups"
subcircuit pullup {
  resistor:R "10 k\Omega" at (0, 0) #amber [orientation=up]
  expose rail = R.out
  expose line = R.in
}

port:VIO "V_{io}" at (90, 90) #blue
pullup:PU_CS0 at (330, 200)
pullup:PU_CS1 at (480, 200)
port:CS0 "CS_0" at (90, 320) #cyan
port:CS1 "CS_1" at (90, 420) #violet
port:FLASH "flash" at (680, 320) #cyan
port:SENSOR "sensor" at (680, 420) #violet

VIO.out -> PU_CS0.rail #blue [ortho]
VIO.out -> PU_CS1.rail #blue [ortho]
CS0.out -> FLASH.in #cyan [ortho]
CS1.out -> SENSOR.in #violet [ortho]
PU_CS0.line -> FLASH.in #cyan [ortho]
PU_CS1.line -> SENSOR.in #violet [ortho]
```

[`parseSchematicSvg`](/docs/1.2/reading-back) reads a compiled sub-circuit back as its flattened parts. Nothing in the SVG records which parts came from which block, and the decompiler does not guess.

<!-- /schemd-section -->
