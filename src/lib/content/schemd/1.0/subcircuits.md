<!-- schemd-doc: id=subcircuits; label=Sub-circuits; title=Write a block once and place it many times; summary=Define reusable sub-circuits with parameters and exposed terminals, nest them, and know exactly what they lower to.; category=Author diagrams; order=27 -->

<!-- schemd-section: id=blocks; eyebrow=01 / Blocks; title=Define a block, then place copies of it; example-title=Two high-pass stages; example-summary=One definition, placed twice with different values, wired through the terminals it exposes. -->

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

```schemd bounds="900x540" title="Two high-pass stages"
subcircuit hp [c="100 nF" r="10 k\Omega"] {
  capacitor:C "{{c}}" at (0, 0) #cyan
  junction:N "v" right-of C by 50 #cyan
  resistor:R "{{r}}" below N by 50 aligned-x with N #amber [orientation=down]
  C.out -> N.node #cyan [ortho]
  N.node -> R.in #amber [ortho]
  expose in = C.in
  expose out = N.node
  expose gnd = R.out
}

source:SIG "V_{sig}" at (90, 160) #blue [type=voltage-ac]
hp:H1 at (260, 160)
hp:H2 at (540, 160) [c="22 nF" r="47 k\Omega"]
port:OUT "V_{hp}" at (820, 160) #emerald
ground:GND "0 V" at (420, 450) #slate

SIG.positive -> H1.in #blue [ortho]
H1.out -> H2.in #cyan [ortho]
H2.out -> OUT.in #emerald [ortho]
SIG.negative -> GND.in #slate [ortho]
H1.gnd -> GND.in #slate [ortho]
H2.gnd -> GND.in #slate [ortho]
```

Outside the block, we never reach for `C` or `R` directly. We wire `H1.out`, a terminal the definition chose to **expose**, and the compiler resolves it to the inner terminal it names. That is what lets us rearrange the inside of a block without touching a single connection that uses it.

<!-- /schemd-section -->

<!-- schemd-section: id=parameters; eyebrow=02 / Parameters; title=Vary each copy with parameters; example-title=Status bank; example-summary=One LED-and-resistor block, three colours, three current-limiting values. -->

A block's header declares the parameters an instance may set. Each one either has a default — `r="330 \Omega"` — or is bare, which makes it required: every instance must set it, or the compile fails naming the instance and the parameter.

Inside the block, `{{name}}` is replaced by the instance's value anywhere on a line — in a label, a colour, an option. Double braces are deliberate: a math label's `V_{out}` is never mistaken for a parameter.

```text
diode:D "{{name}}" right-of R by 70 #{{tone}} [type=led]
```

Values follow the same rules as connection options: `tone=amber` needs no quotes, and anything with a space does. An unknown parameter, one set twice, or a `{{placeholder}}` the header never declared is a compile error on the line that caused it.

```schemd bounds="760x500" title="Status bank"
subcircuit status [name tone r="330 \Omega"] {
  resistor:R "{{r}}" at (0, 0) #amber
  diode:D "{{name}}" right-of R by 70 #{{tone}} [type=led]
  R.out -> D.anode #{{tone}} [ortho]
  expose a = R.in
  expose k = D.cathode
}

port:V3 "3.3 V" at (90, 100) #blue
status:S1 at (260, 100) [name=power tone=emerald r="150 \Omega"]
status:S2 at (260, 220) [name=link tone=blue r="100 \Omega"]
status:S3 at (260, 340) [name=error tone=rose]
ground:GND "0 V" at (660, 420) #slate

V3.out -> S1.a #blue [ortho]
V3.out -> S2.a #blue [ortho]
V3.out -> S3.a #blue [ortho]
S1.k -> GND.in #slate [ortho]
S2.k -> GND.in #slate [ortho]
S3.k -> GND.in #slate [ortho]
```

The three current-limiting resistors differ because the LEDs' forward voltages do, and that is exactly the kind of difference a parameter should carry — the structure is shared, the values are not.

<!-- /schemd-section -->

<!-- schemd-section: id=nesting; eyebrow=03 / Nesting; title=Build blocks out of blocks; example-title=Two-pole high-pass from nested stages; example-summary=A two-pole block made of two one-pole blocks, with parameters passed straight through. -->

A block may place other blocks, so a two-pole high-pass can be written as two one-pole stages rather than as four parts. Parameters pass through by placeholder — `hp:A at (0, 0) [c="{{c}}" r="{{r1}}"]` hands the outer instance's values to the inner one — and an exposed terminal may name a terminal of a nested instance, which the compiler follows down through every level.

```schemd bounds="960x540" title="Two-pole high-pass from nested stages"
subcircuit hp [c r] {
  capacitor:C "{{c}}" at (0, 0) #cyan
  junction:N "v" right-of C by 50 #cyan
  resistor:R "{{r}}" below N by 50 aligned-x with N #amber [orientation=down]
  C.out -> N.node #cyan [ortho]
  N.node -> R.in #amber [ortho]
  expose in = C.in
  expose out = N.node
  expose gnd = R.out
}

subcircuit pair [r1 r2 c="47 nF"] {
  hp:A at (0, 0) [c="{{c}}" r="{{r1}}"]
  hp:B at (290, 0) [c="{{c}}" r="{{r2}}"]
  A.out -> B.in #cyan [ortho]
  expose in = A.in
  expose out = B.out
  expose ga = A.gnd
  expose gb = B.gnd
}

source:MIC "V_{mic}" at (90, 160) #blue [type=voltage-ac]
pair:F at (250, 160) [r1="3.3 k\Omega" r2="33 k\Omega"]
port:OUT "V_{hp}" at (870, 160) #emerald
ground:GND "0 V" at (400, 450) #slate

MIC.positive -> F.in #blue [ortho]
F.out -> OUT.in #emerald [ortho]
MIC.negative -> GND.in #slate [ortho]
F.ga -> GND.in #slate [ortho]
F.gb -> GND.in #slate [ortho]
```

A block that contains itself — directly, or through a chain of others — is refused, and the diagnostic names the chain: `Subcircuit a contains itself through a -> b -> a`.

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=04 / Lowering; title=Know exactly what a block becomes; example-title=Open-drain pull-ups; example-summary=Two copies of one pull-up block, which lower to parts named PU_INT_R and PU_RST_R. -->

A sub-circuit is not a new kind of object. Like [relative placement](/docs/1.0/placement), it is lowered to declarations the compiler already understands before anything else reads the document, so every later pass — validation, routing, the netlist, the renderer, the source map — sees an ordinary flat document. It is worth knowing the lowering rules precisely, because they are what we see in the output.

- **Ids are prefixed.** Each inner id becomes the instance id, an underscore, and the inner id: `PU_INT` places `R` as `PU_INT_R`, and a nested instance adds a level, `F_A_R`. Those are the ids the netlist, the SVG's `data-node-id`, and the designators carry.
- **Positions are offset.** An inner `at (x, y)` moves by the instance's position; an inner relation is re-pointed at the prefixed ids.
- **Lines are kept.** A copied declaration keeps the line of the definition line that wrote it, so a diagnostic about a body declaration points at the declaration, and the source map sends every copy of `R` to the one line that declares it.
- **A block reaches only its own parts.** Every id inside the braces is prefixed, so a reference out of the block names a part that does not exist — blocks cannot quietly depend on their surroundings.
- **Expansion is budgeted.** The expanded declarations count against the same [`sourceCharacters`](/docs/1.0/limits) limit as the source. An instance is shorthand for the parts it stands for, and without a ceiling three levels of eight instances would turn fourteen lines into 512 parts.
- **A block that is never placed is an error.** So is one that would shadow a built-in kind, a duplicate definition, one left unclosed, `expose` outside a block, and an id shared by an instance and a part.

```schemd bounds="760x500" title="Open-drain pull-ups"
subcircuit pullup {
  resistor:R "10 k\Omega" at (0, 0) #amber [orientation=up]
  expose rail = R.out
  expose line = R.in
}

port:VIO "V_{io}" at (90, 90) #blue
pullup:PU_INT at (330, 200)
pullup:PU_RST at (480, 200)
port:INT "INT" at (90, 320) #cyan
port:RST "RST" at (90, 420) #violet
port:HOST_INT "to host" at (680, 320) #cyan
port:HOST_RST "to host" at (680, 420) #violet

VIO.out -> PU_INT.rail #blue [ortho]
VIO.out -> PU_RST.rail #blue [ortho]
INT.out -> HOST_INT.in #cyan [ortho]
RST.out -> HOST_RST.in #violet [ortho]
PU_INT.line -> HOST_INT.in #cyan [ortho]
PU_RST.line -> HOST_RST.in #violet [ortho]
```

Reading a compiled sub-circuit back with [`parseSchematicSvg`](/docs/1.0/reading-back) returns the flattened parts, not the block: nothing in the SVG says which parts came from where, and the decompiler does not guess.

<!-- /schemd-section -->
