<!-- schemd-doc: id=subcircuits; label=Sub-circuits; title=Write a block once and place it many times; summary=Define reusable sub-circuits with parameters and exposed terminals, nest them, and know exactly what they lower to.; category=Author diagrams; order=27 -->

<!-- schemd-section: id=blocks; eyebrow=01 / Blocks; title=Define a block, then place copies of it; example-title=Two low-pass stages; example-summary=One definition, placed twice with different values, wired through the terminals it exposes. -->

Real schematics repeat themselves. A filter has two identical stages, a board has four identical bypass networks, an LED bank is the same resistor-and-diode pair three times. Writing each copy out by hand is how a fix lands in one copy and not the others.

A sub-circuit is a block we write once:

```text
subcircuit NAME [parameters] {
  …ordinary declarations…
  expose TERMINAL = PART.port
}
```

and place by name, as often as we like:

```text
NAME:ID at (x, y) [name=value]
```

Inside the braces is the language we already know — components, connections, relative placement, comments. Coordinates written with `at (x, y)` are relative to the block's own origin, and the instance's position moves the whole block. An instance has no label or colour of its own; it is a placement, not a part.

```schemd bounds="900x540" title="Two low-pass stages"
subcircuit lp [r="1 k\Omega" c="100 nF"] {
  resistor:R "{{r}}" at (0, 0) #amber
  junction:N "v" right-of R by 50 #cyan
  capacitor:C "{{c}}" below N by 50 aligned-x with N #cyan [orientation=down]
  R.out -> N.node #amber [ortho]
  N.node -> C.in #cyan [ortho]
  expose in = R.in
  expose out = N.node
  expose gnd = C.out
}

source:SRC "V_{src}" at (90, 160) #blue [type=voltage-ac]
lp:L1 at (260, 160)
lp:L2 at (540, 160) [r="4.7 k\Omega" c="22 nF"]
port:VLP "V_{lp}" at (820, 160) #emerald
ground:GND "0 V" at (420, 450) #slate

SRC.positive -> L1.in #blue [ortho]
L1.out -> L2.in #cyan [ortho]
L2.out -> VLP.in #emerald [ortho]
SRC.negative -> GND.in #slate [ortho]
L1.gnd -> GND.in #slate [ortho]
L2.gnd -> GND.in #slate [ortho]
```

Outside the block, we never reach for `R` or `C` directly. We wire `L1.out`, a terminal the definition chose to **expose**, and the compiler resolves it to the inner terminal it names. That is what lets us rearrange the inside of a block without touching a single connection that uses it.

<!-- /schemd-section -->

<!-- schemd-section: id=parameters; eyebrow=02 / Parameters; title=Vary each copy with parameters; example-title=Indicator bank; example-summary=One LED-and-resistor block, three colours, three current-limiting values. -->

A block's header declares the parameters an instance may set. Each one either has a default — `r="470 \Omega"` — or is bare, which makes it required: every instance must set it, or the compile fails naming the instance and the parameter.

Inside the block, `{{name}}` is replaced by the instance's value anywhere on a line — in a label, a colour, an option. Double braces are deliberate: a math label's `V_{out}` is never mistaken for a parameter.

```text
diode:D "{{name}}" right-of R by 70 #{{tone}} [type=led]
```

Values follow the same rules as connection options: `tone=amber` needs no quotes, and anything with a space does. An unknown parameter, one set twice, or a `{{placeholder}}` the header never declared is a compile error on the line that caused it.

```schemd bounds="760x500" title="Indicator bank"
subcircuit lamp [name tone r="470 \Omega"] {
  resistor:R "{{r}}" at (0, 0) #amber
  diode:D "{{name}}" right-of R by 70 #{{tone}} [type=led]
  R.out -> D.anode #{{tone}} [ortho]
  expose a = R.in
  expose k = D.cathode
}

port:V5 "5 V" at (90, 100) #blue
lamp:I1 at (260, 100) [name=charge tone=amber r="270 \Omega"]
lamp:I2 at (260, 220) [name=standby tone=cyan r="220 \Omega"]
lamp:I3 at (260, 340) [name=fault tone=rose]
ground:GND "0 V" at (660, 420) #slate

V5.out -> I1.a #blue [ortho]
V5.out -> I2.a #blue [ortho]
V5.out -> I3.a #blue [ortho]
I1.k -> GND.in #slate [ortho]
I2.k -> GND.in #slate [ortho]
I3.k -> GND.in #slate [ortho]
```

The three current-limiting resistors differ because the LEDs' forward voltages do, and that is exactly the kind of difference a parameter should carry — the structure is shared, the values are not.

<!-- /schemd-section -->

<!-- schemd-section: id=nesting; eyebrow=03 / Nesting; title=Build blocks out of blocks; example-title=Two-pole low-pass from nested stages; example-summary=A two-pole block made of two one-pole blocks, with parameters passed straight through. -->

A block may place other blocks, so a two-pole low-pass can be written as two one-pole stages rather than as four parts. Parameters pass through by placeholder — `lp:A at (0, 0) [r="{{r}}" c="{{c1}}"]` hands the outer instance's values to the inner one — and an exposed terminal may name a terminal of a nested instance, which the compiler follows down through every level.

```schemd bounds="960x540" title="Two-pole low-pass from nested stages"
subcircuit lp [r c] {
  resistor:R "{{r}}" at (0, 0) #amber
  junction:N "v" right-of R by 50 #cyan
  capacitor:C "{{c}}" below N by 50 aligned-x with N #cyan [orientation=down]
  R.out -> N.node #amber [ortho]
  N.node -> C.in #cyan [ortho]
  expose in = R.in
  expose out = N.node
  expose gnd = C.out
}

subcircuit pair [c1 c2 r="2.2 k\Omega"] {
  lp:A at (0, 0) [r="{{r}}" c="{{c1}}"]
  lp:B at (290, 0) [r="{{r}}" c="{{c2}}"]
  A.out -> B.in #cyan [ortho]
  expose in = A.in
  expose out = B.out
  expose ga = A.gnd
  expose gb = B.gnd
}

source:DAC "V_{dac}" at (90, 160) #blue [type=voltage-ac]
pair:F at (250, 160) [c1="10 nF" c2="1 nF"]
port:VRC "V_{rc}" at (870, 160) #emerald
ground:GND "0 V" at (400, 450) #slate

DAC.positive -> F.in #blue [ortho]
F.out -> VRC.in #emerald [ortho]
DAC.negative -> GND.in #slate [ortho]
F.ga -> GND.in #slate [ortho]
F.gb -> GND.in #slate [ortho]
```

A block that contains itself — directly, or through a chain of others — is refused, and the diagnostic names the chain: `Subcircuit a contains itself through a -> b -> a`.

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=04 / Lowering; title=Know exactly what a block becomes; example-title=I2C pull-ups; example-summary=Two copies of one pull-up block, which lower to parts named PU_SDA_R and PU_SCL_R. -->

A sub-circuit is not a new kind of object. Like [relative placement](/docs/1.1/placement), it is lowered to declarations the compiler already understands before anything else reads the document, so every later pass — validation, routing, the netlist, the renderer, the source map — sees an ordinary flat document. It is worth knowing the lowering rules precisely, because they are what we see in the output.

- **Ids are prefixed.** Each inner id becomes the instance id, an underscore, and the inner id: `PU_SDA` places `R` as `PU_SDA_R`, and a nested instance adds a level, `F_A_R`. Those are the ids the netlist, the SVG's `data-node-id`, and the designators carry.
- **Positions are offset.** An inner `at (x, y)` moves by the instance's position; an inner relation is re-pointed at the prefixed ids.
- **Lines are kept.** A copied declaration keeps the line of the definition line that wrote it, so a diagnostic about a body declaration points at the declaration, and the source map sends every copy of `R` to the one line that declares it.
- **A block reaches only its own parts.** Every id inside the braces is prefixed, so a reference out of the block names a part that does not exist — blocks cannot quietly depend on their surroundings.
- **Expansion is budgeted.** The expanded declarations count against the same [`sourceCharacters`](/docs/1.1/limits) limit as the source. An instance is shorthand for the parts it stands for, and without a ceiling three levels of eight instances would turn fourteen lines into 512 parts.
- **A block that is never placed is an error.** So is one that would shadow a built-in kind, a duplicate definition, one left unclosed, `expose` outside a block, and an id shared by an instance and a part.

```schemd bounds="760x500" title="I2C pull-ups"
subcircuit pullup {
  resistor:R "4.7 k\Omega" at (0, 0) #amber [orientation=up]
  expose rail = R.out
  expose line = R.in
}

port:VBUS "V_{bus}" at (90, 90) #blue
pullup:PU_SDA at (330, 200)
pullup:PU_SCL at (480, 200)
port:SDA "SDA" at (90, 320) #cyan
port:SCL "SCL" at (90, 420) #violet
port:DEV_SDA "to device" at (680, 320) #cyan
port:DEV_SCL "to device" at (680, 420) #violet

VBUS.out -> PU_SDA.rail #blue [ortho]
VBUS.out -> PU_SCL.rail #blue [ortho]
SDA.out -> DEV_SDA.in #cyan [ortho]
SCL.out -> DEV_SCL.in #violet [ortho]
PU_SDA.line -> DEV_SDA.in #cyan [ortho]
PU_SCL.line -> DEV_SCL.in #violet [ortho]
```

Reading a compiled sub-circuit back with [`parseSchematicSvg`](/docs/1.1/reading-back) returns the flattened parts, not the block: nothing in the SVG says which parts came from where, and the decompiler does not guess.

<!-- /schemd-section -->
