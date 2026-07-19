<!-- schemd-doc: id=component-reference; label=Component API; title=Find a component and its ports; summary=A compact reference for every circuit, logic, quantum, IC, and UML node.; category=Author diagrams; order=40 -->

<!-- schemd-section: id=passives; eyebrow=01 / Circuit; title=Passive components; example-title=RLC signal path; example-summary=The three passive symbols use the same left-to-right port contract. -->

The three passives — `resistor`, `capacitor`, and `inductor` — are fixed horizontal symbols. Whatever distinguishes one from the next (a value, a tolerance, a role) lives in the quoted label, not in the geometry.

| Kind        | Left ports        | Right ports         | Options |
| ----------- | ----------------- | ------------------- | ------- |
| `resistor`  | `in`, `left`, `l` | `out`, `right`, `r` | None    |
| `capacitor` | `in`, `left`, `l` | `out`, `right`, `r` | None    |
| `inductor`  | `in`, `left`, `l` | `out`, `right`, `r` | None    |

```schemd bounds="900x300" title="RLC signal path"
port:IN "Input" at (55, 150) #blue
resistor:R1 "10 k\Omega" at (240, 150) #amber
inductor:L1 "22 \muH" at (450, 150) #purple
capacitor:C1 "100 nF" at (660, 150) #cyan
port:OUT "Output" at (845, 150) #emerald

IN.out -> R1.in #blue [line]
R1.out -> L1.in #amber [line]
L1.out -> C1.in #purple [line]
C1.out -> OUT.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=semiconductors; eyebrow=02 / Circuit; title=Diodes and transistors; example-title=NMOS protected switch; example-summary=A gate-controlled transistor feeds a protected output. -->

A `diode` keeps its anode on the left and cathode on the right; pick the flavor with `type=standard|schottky|zener|led`. A `transistor` takes `type=npn|pnp|nmos|pmos`, and — usefully — the BJT and FET names point at the same physical terminals, so you may wire it in whichever vocabulary you think in.

| Node         | Ports                                                                          |
| ------------ | ------------------------------------------------------------------------------ |
| `diode`      | `anode`/`a`, `cathode`/`k`/`c`                                                 |
| `transistor` | `base`/`gate`/`b`/`g`, `collector`/`drain`/`c`/`d`, `emitter`/`source`/`e`/`s` |

```schemd bounds="860x400" title="NMOS protected switch"
port:CTRL "Gate" at (70, 190) #blue
transistor:Q1 "2N7002" at (350, 190) #cyan [type=nmos]
diode:D1 "Clamp" at (590, 105) #purple [type=schottky]
port:OUT "Load" at (800, 105) #emerald
ground:GND "Ground" at (350, 325) #slate

CTRL.out -> Q1.gate #blue [line]
Q1.drain -> D1.anode #cyan [ortho]
D1.cathode -> OUT.in #emerald [line marker-end=arrow]
Q1.source -> GND.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=boundaries; eyebrow=03 / Circuit; title=Ports and grounds; example-title=Referenced input; example-summary=A boundary port feeds a resistor tied to signal ground. -->

A `port` marks the edge of a system and exposes exactly `in` and `out` — nothing more, because an edge should not pretend to be a component. A `ground` carries a single `in` port above the symbol; choose `style=signal`, `earth`, or `chassis`, and `signal` is what you get when you say nothing.

```schemd bounds="720x320" title="Referenced input"
port:VIN "Input" at (70, 100) #blue
resistor:R1 "1 M\Omega" at (320, 100) #amber
ground:GND "Reference" at (520, 240) #slate [style=earth]

VIN.out -> R1.in #blue [line]
R1.out -> GND.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=logic-gates; eyebrow=04 / Logic; title=Classical logic gates; example-title=Parity and inversion; example-summary=Indexed pins keep configurable fan-in and fan-out explicit. -->

The built-in gates are the six you would expect: `and`, `nand`, `or`, `nor`, `xor`, and `not`. Scale the fan-in and fan-out explicitly with `inputs=1..32` and `outputs=1..32`, choose a `standard=ieee|iec` body, and remember that `not` always has exactly one input. Ports are `in1..inN` and `out1..outN`, with `in` and `out` aliasing the first pins for the common case.

```schemd bounds="860x340" title="Parity and inversion"
port:A "A" at (60, 90) #blue
port:B "B" at (60, 250) #blue
xor:X1 "Parity" at (330, 170) #cyan [inputs=2 outputs=1]
not:N1 "Invert" at (590, 170) #amber [outputs=1 standard=iec]
port:Y "Y" at (800, 170) #emerald

A.out -> X1.in1 #blue [bezier]
B.out -> X1.in2 #blue [bezier]
X1.out -> N1.in #cyan [line]
N1.out -> Y.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=quantum-gates; eyebrow=05 / Quantum; title=Quantum gates; example-title=Small quantum pipeline; example-summary=Native and custom operators share a left-to-right register path. -->

`hadamard` exposes `in` and `out`; `cnot` adds `control` and `target`; and `qgate` is the escape hatch — a custom operator block that accepts quoted `parameter`, `matrix`, and `phase` rows. As everywhere in schemd, every visible string supports micro-math, so an operator can wear its own definition.

```schemd bounds="940x400" title="Small quantum pipeline"
port:QIN "|0〉" at (55, 200) #slate
hadamard:H1 "H" at (230, 200) #purple
qgate:RZ "R_z" at (440, 200) #cyan [parameter="\theta/2" phase="\pi/4"]
cnot:CX "CNOT" at (660, 200) #purple
port:QOUT "|1〉" at (880, 200) #emerald
port:CTRL "Control" at (660, 65) #blue
port:TARGET "Target" at (660, 335) #amber

QIN.out -> H1.in #slate [line]
H1.out -> RZ.in #purple [line]
RZ.out -> CX.in #cyan [line]
CX.out -> QOUT.in #emerald [line marker-end=arrow]
CTRL.out -> CX.control #blue [line]
CX.target -> TARGET.in #amber [line]
```

<!-- /schemd-section -->

<!-- schemd-section: id=integrated-circuits; eyebrow=06 / Blocks; title=Integrated circuits; example-title=Configurable controller; example-summary=Named pin lists create an addressable multi-sided package. -->

`ic` takes quoted, comma-separated `left`, `right`, `top`, and `bottom` pin lists. Each name becomes a case-sensitive port, and the body grows to fit the longest side, so you never hand-size the box. Wire with the real pin name — `U1.DATA` — and let `in`/`out` fall back to the first suitable input and output sides when you genuinely do not care which.

```schemd bounds="960x480" title="Configurable controller"
port:INPUT "Sensor bus" at (60, 230) #blue
port:CLOCK "Clock" at (430, 60) #amber
ic:U1 "Flight computer" at (480, 240) #cyan [left="DATA,ENABLE,RESET" right="ACTUATOR,FAULT" top="CLK,VCC" bottom="GND,VSS"]
port:OUTPUT "Actuator" at (900, 220) #emerald
ground:GND "Reference" at (520, 410) #slate

INPUT.out -> U1.DATA #blue [ortho]
CLOCK.out -> U1.CLK #amber [ortho]
U1.ACTUATOR -> OUTPUT.in #emerald [ortho marker-end=arrow]
U1.GND -> GND.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=uml-structure; eyebrow=07 / UML; title=Classes, packages, and notes; example-title=Order model; example-summary=Auto-sized class compartments connect to package and note nodes. -->

`class` accepts semicolon-separated `attributes` and `operations`, plus an optional `stereotype` and `width`. Its height grows with the rows and its width grows to fit the widest visible string — the compartment is always exactly as large as its contents demand, never a pixel of guesswork. `package` and `note` take `width` and `height`; they are ordinary nodes, _not_ automatic layout containers, and that distinction is worth keeping straight. Every UML node exposes `left`, `right`, `top`, `bottom`, `in`, and `out`.

```schemd bounds="960x480" title="Order model"
package:Domain "Domain" at (120, 70) #slate [width=160]
class:Order "Order" at (280, 215) #blue [attributes="- id: UUID; - total: Money" operations="+ submit(): void"]
class:LineItem "LineItem" at (720, 215) #emerald [attributes="- quantity: number"]
note:Rule "An order owns its items" at (480, 405) #amber [width=210]

Domain.bottom -> Order.top #slate [ortho dependency]
Order.right -> LineItem.left #emerald [ortho composition label="contains"]
Rule.top -> Order.bottom #amber [ortho dependency label="documents"]
```

<!-- /schemd-section -->

<!-- schemd-section: id=uml-behavior; eyebrow=08 / UML; title=Actors, use cases, states, and pseudostates; example-title=Checkout flow; example-summary=Use-case and state nodes share the same relationship grammar. -->

`actor`, `initial`, and `final` need no options at all. `usecase` accepts `width` and `height`; `state` accepts semicolon-separated `details` and an optional `width`. For the connectors, reach for `association` to show participation, `include` and `extend` between use cases, and `transition` for state flow — the same relationship grammar you met in the class diagram, doing behavioral work.

```schemd bounds="920x440" title="Checkout flow"
actor:Customer "Customer" at (80, 145) #blue
usecase:Checkout "Checkout" at (300, 145) #cyan
usecase:Auth "Authenticate" at (300, 310) #purple
state:Pending "Pending" at (590, 145) #amber [details="entry / reserve; exit / charge"]
initial:Start "Start" at (590, 330) #slate
final:Done "Done" at (820, 330) #emerald

Customer.right -> Checkout.left #blue [line association]
Checkout.bottom -> Auth.top #purple [ortho include]
Checkout.right -> Pending.left #amber [line transition label="submit"]
Start.right -> Done.left #emerald [line transition label="complete"]
```

<!-- /schemd-section -->

<!-- schemd-section: id=uml-sequence; eyebrow=09 / UML; title=Sequence lifelines and messages; example-title=Request and response; example-summary=Offsets place messages at exact heights along two lifelines. -->

`lifeline` accepts `width` and `height`, and — the detail that makes sequence diagrams actually work — alongside the usual side ports, `leftNN` and `rightNN` place a port exactly `NN` units below the top of the lifeline. Use `message` for an open arrow, add `dashed` for a reply, and `label="..."` for the message text itself.

```schemd bounds="800x440" title="Request and response"
lifeline:Client "Client" at (200, 220) #blue [width=140 height=320]
lifeline:API "Orders API" at (600, 220) #emerald [width=140 height=320]

Client.right80 -> API.left80 #blue [line message label="GET /orders"]
API.left160 -> Client.right160 #emerald [line message dashed label="200 OK"]
```

<!-- /schemd-section -->
