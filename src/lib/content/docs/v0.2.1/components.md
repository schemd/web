<!-- schemd-doc: id=components; label=Components; title=Find a component and its ports; summary=A compact reference for circuits, logic, quantum operators, configurable ICs, and UML nodes.; category=Author diagrams; order=30 -->

<!-- schemd-section: id=circuit; eyebrow=01 / Circuit; title=Use passives, semiconductors, boundaries, and ground -->

| Kind                                | Primary ports                                   | Options                                     |
| ----------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| `resistor`, `capacitor`, `inductor` | `in`, `out` with left and right aliases         | None                                        |
| `diode`                             | `anode`, `cathode`                              | `type=standard`, `schottky`, `zener`, `led` |
| `transistor`                        | `base`, `collector`, `emitter` with FET aliases | `type=npn`, `pnp`, `nmos`, `pmos`           |
| `port`                              | `in`, `out`                                     | None                                        |
| `ground`                            | `in`                                            | `style=signal`, `earth`, `chassis`          |

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

<!-- schemd-section: id=logic-quantum; eyebrow=02 / Gates; title=Address classical and quantum operators -->

Classical gates are `and`, `nand`, `or`, `nor`, `xor`, and `not`. Use `inputs=1..32`, `outputs=1..32`, and `standard=ieee|iec`. Pins are `in1..inN` and `out1..outN`; `in` and `out` alias the first pins.

Quantum operators are `hadamard`, `cnot`, and `qgate`. A custom `qgate` accepts quoted `parameter`, `matrix`, and `phase` rows.

```schemd bounds="940x400" title="Small quantum pipeline"
port:QIN "|0〉" at (55, 200) #slate
hadamard:H1 "H" at (230, 200) #purple
qgate:RZ "R_z" at (440, 200) #cyan [parameter="\theta/2" phase="\pi/4"]
cnot:CX "CNOT" at (660, 200) #purple
port:QOUT "|1〉" at (880, 200) #emerald
port:CTRL "Control" at (660, 65) #blue

QIN.out -> H1.in #slate [line]
H1.out -> RZ.in #purple [line]
RZ.out -> CX.in #cyan [line]
CX.out -> QOUT.in #emerald [line marker-end=arrow]
CTRL.out -> CX.control #blue [line]
```

<!-- /schemd-section -->

<!-- schemd-section: id=integrated-circuits; eyebrow=03 / Blocks; title=Create named pins on configurable ICs -->

`ic` accepts quoted comma-separated `left`, `right`, `top`, and `bottom` pin lists. Each name becomes a case-sensitive port. The body grows to fit the longest side.

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

<!-- schemd-section: id=uml; eyebrow=04 / UML; title=Model structure and behaviour -->

Built-in UML nodes include `class`, `actor`, `usecase`, `state`, `lifeline`, `note`, `package`, `initial`, and `final`. Every UML node exposes `left`, `right`, `top`, `bottom`, `in`, and `out`.

Classes accept semicolon-separated `attributes` and `operations`. States accept `details`. Lifeline ports such as `left80` and `right160` address a precise vertical offset.

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
