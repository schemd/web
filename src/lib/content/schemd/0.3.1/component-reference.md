<!-- schemd-doc: id=component-reference; label=Component API; title=Use every 0.3 primitive deliberately; summary=Exhaustive families, variants, options, semantic ports, and canonical orientations.; category=Author diagrams; order=40 -->

Every direction-sensitive family defaults to `orientation=right`. `junction` and other rotationally symmetric nodes reject the option. Aliases remain accepted for compatibility, but the port names below are the stable names emitted in full-mode metadata.

<!-- schemd-section: id=electrical; eyebrow=01 / Electrical; title=Sources, connectivity, switching, and instruments; example-title=Typed analog signal chain -->

| Kind                    | `type` variants                                                                                                    | Stable ports                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `source`                | `voltage-dc`, `voltage-ac`, `voltage-pulse`, `current-dc`, `current-ac`, `battery`, `vcvs`, `vccs`, `ccvs`, `cccs` | `negative`, `positive`; dependent sources add `control-positive`, `control-negative`     |
| `junction`, `testpoint` | —                                                                                                                  | `node`                                                                                   |
| `connector`             | —                                                                                                                  | `in`, `out`                                                                              |
| `power`                 | `vcc`, `vdd`, `vss`, `positive`, `negative`                                                                        | `in`                                                                                     |
| `switch`                | `spst`, `spdt`, `pushbutton`, `relay`                                                                              | `in`, `out`; SPDT: `common`, `normally-open`, `normally-closed`; relay: `coil1`, `coil2` |
| `protection`            | `fuse`, `breaker`                                                                                                  | `in`, `out`                                                                              |
| `amplifier`             | `opamp`, `comparator`, `instrumentation`                                                                           | `positive`, `negative`, `out`, `v+`, `v-`                                                |
| `resonator`             | `crystal`, `ceramic`                                                                                               | `in`, `out`                                                                              |
| `meter`                 | `voltmeter`, `ammeter`                                                                                             | `in`, `out`                                                                              |
| `load`                  | `lamp`, `motor`, `speaker`, `buzzer`                                                                               | `in`, `out`                                                                              |

```schemd bounds="980x460" title="Typed analog signal chain"
source:V1 "AC source" at (90, 140) #blue [type=voltage-ac]
protection:F1 "fuse" at (250, 140) #amber [type=fuse]
amplifier:A1 "instrumentation" at (470, 140) #cyan [type=instrumentation]
meter:M1 "V" at (690, 140) #purple [type=voltmeter]
load:L1 "speaker" at (870, 140) #emerald [type=speaker]
power:VDD "VDD" at (470, 300) #amber [type=vdd orientation=up]

V1.positive -> F1.in #blue [line]
F1.out -> A1.positive #amber [line]
A1.out -> M1.in #cyan [line]
M1.out -> L1.in #purple [line]
VDD.in -> A1.v+ #amber [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=passives-semiconductors; eyebrow=02 / Electrical; title=Passives and semiconductor variants; example-title=Variant family specimen -->

Passives share `in`/`out`; diodes expose `anode`/`cathode`. Transistor controls are `base` for BJT, `gate` for FET/IGBT, plus `collector`/`emitter` or `drain`/`source`.

| Kind         | Variants                                                                         |
| ------------ | -------------------------------------------------------------------------------- |
| `resistor`   | `fixed`, `variable`, `rheostat`, `potentiometer`, `thermistor`, `ldr`            |
| `capacitor`  | `fixed`, `variable`, `polarized`                                                 |
| `inductor`   | `fixed`, `coupled`, `transformer`                                                |
| `diode`      | `standard`, `schottky`, `zener`, `led`, `photodiode`, `varactor`, `scr`, `triac` |
| `transistor` | `npn`, `pnp`, `nmos`, `pmos`, `njfet`, `pjfet`, `nigbt`, `pigbt`                 |
| `port`       | optional `width=1..256`; `in`, `out`                                             |
| `ground`     | `signal`, `earth`, `chassis`; `in`                                               |

```schemd bounds="1040x430" title="Variant family specimen"
resistor:R1 "LDR" at (100, 130) #amber [type=ldr orientation=down]
capacitor:C1 "C_{pol}" at (280, 130) #cyan [type=polarized orientation=up]
inductor:T1 "T" at (470, 130) #purple [type=transformer]
diode:D1 "photo" at (660, 130) #blue [type=photodiode orientation=left]
transistor:Q1 "IGBT" at (850, 130) #emerald [type=nigbt orientation=down]
```

<!-- /schemd-section -->

<!-- schemd-section: id=digital; eyebrow=03 / Digital; title=Logic, sequential blocks, and explicit buses; example-title=Registered bus pipeline -->

Classical gates are `and`, `or`, `not`, `nand`, `nor`, `xor`, and `xnor`; they use indexed `in1..inN`, `out1..outN` and accept `standard=ieee|iec`.

| Kind                 | `type` variants                                                         | Stable special ports                                              |
| -------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `buffer`             | `plain`, `tristate`, `tristate-inverter`, `schmitt`, `schmitt-inverter` | `in1`, `out1`; tri-state adds `enable`                            |
| `logic`              | `high`, `low`, `unknown`, `high-z`                                      | `out`                                                             |
| `clock`              | —                                                                       | `out`                                                             |
| `flipflop`           | `sr-latch`, `d-latch`, `d`, `jk`, `t`                                   | `clock`, `enable`, `preset`, `clear`, `q`, `nq`, plus type inputs |
| `mux`                | `mux`, `demux`                                                          | indexed data ports, `select`, `enable`                            |
| `encoder`, `decoder` | —                                                                       | indexed inputs/outputs                                            |
| `register`           | —                                                                       | `in`, `out`, `clock`, `enable`, `clear`; `width=2..256`           |
| `counter`            | —                                                                       | indexed output, `clock`, `enable`, `clear`                        |
| `adder`              | `half`, `full`                                                          | indexed inputs/outputs                                            |
| `comparator`         | —                                                                       | `in1`, `in2`, `gt`, `eq`, `lt`                                    |
| `bus`                | `tap`, `splitter`, `joiner`                                             | `bus`, `tap`, or indexed branches; `width=2..256`                 |

```schemd bounds="1020x430" title="Registered bus pipeline"
port:DIN "D[7:0]" at (80, 150) #blue [width=8]
bus:SPLIT "split" at (270, 150) #cyan [type=splitter width=8 outputs=2]
register:REG "R0" at (520, 150) #purple [width=8]
clock:CLK "CLK" at (520, 310) #amber
port:DOUT "Q[7:0]" at (850, 150) #emerald [width=8]

DIN.out -> REG.in #blue [digital width=8]
CLK.out -> REG.clock #amber [digital ortho]
REG.out -> DOUT.in #emerald [digital width=8]
```

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=04 / Quantum; title=Named gates, multi-track operators, and classical results; example-title=Measured controlled rotation -->

Single-qubit shells are `hadamard`, `qgate`, `xgate`, `ygate`, `zgate`, `sgate`, `sdg`, `tgate`, `tdg`, `sx`, `phase`, `rx`, `ry`, `rz`, and `ugate`; they use `in`/`out`. `qgate` accepts `parameter`, `phase`, and `matrix` detail rows.

| Kind                                                                | Stable ports and options                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `measure`                                                           | `in`, `out`, `classical`                                                             |
| `reset`                                                             | `in`, `out`                                                                          |
| `prepare`                                                           | `out`                                                                                |
| `control`                                                           | `in`, `out`, `control`; `control=positive                                            | negative | classical` |
| `swap`, `cz`, `cphase`, `toffoli`, `controlled`, `barrier`, `delay` | indexed `inN`, `outN`, `controlN`, `targetN`; bounded `wires`, `controls`, `targets` |
| `classical-bit`                                                     | `in`, `out`                                                                          |
| `classical-register`                                                | `in`, `out`, `width=2..256`                                                          |

```schemd bounds="1040x440" title="Measured controlled rotation"
prepare:P0 "|0\rangle" at (80, 120) #blue
prepare:P1 "|0\rangle" at (80, 280) #blue
hadamard:H "H" at (260, 120) #cyan
controlled:CRZ "R_z" at (500, 200) #purple [controls=1 targets=1 operator="R_z"]
measure:M "M" at (750, 120) #emerald
classical-bit:C "c_0" at (940, 280) #slate

P0.out -> H.in #blue [quantum line]
H.out -> CRZ.control1 #cyan [quantum ortho]
P1.out -> CRZ.target1 #blue [quantum ortho]
CRZ.out1 -> M.in #purple [quantum ortho]
M.classical -> C.in #slate [classical ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=uml; eyebrow=05 / UML; title=Structural, deployment, activity, state, and interaction nodes; example-title=Deployment and activity model -->

The UML catalog includes:

- Structure: `class`, `interface`, `provided-interface`, `required-interface`, `enumeration`, `datatype`, `object`, `component`, `component-port`, `artifact`, `node`, `device`, `execution`, `system`, `package`, `note`.
- Behavior: `actor`, `usecase`, `state`, `action`, `decision`, `merge`, `fork`, `join`, `activity-final`, `flow-final`, `object-node`, `send-signal`, `receive-signal`, `partition`.
- Interaction/state: `lifeline`, `activation`, `destruction`, `fragment`, `interaction`, `gate`, `found`, `lost`, `choice`, `state-junction`, `history`, `entry`, `exit`, `terminate`, `region`, `initial`, `final`.

Sized rectangular nodes accept bounded `width` and `height`. Class-like nodes additionally accept `stereotype`, `attributes`, and `operations`. Their ports are `left`, `right`, `top`, and `bottom`.

Relations are `association`, `dependency`, `generalization`, `realization`, `aggregation`, `composition`, `message`, `synchronous`, `asynchronous`, `return`, `control-flow`, `object-flow`, `assembly`, `delegation`, `transition`, `include`, and `extend`.

```schemd bounds="980x500" title="Deployment and activity model"
device:EDGE "Edge device" at (170, 150) #blue [width=180 height=100]
artifact:FW "firmware.bin" at (480, 150) #amber [width=170 height=90]
node:CLOUD "Cloud node" at (790, 150) #purple [width=180 height=100]
action:DEPLOY "Deploy" at (480, 350) #cyan [width=150 height=70]

EDGE.right -> FW.left #blue [assembly]
FW.right -> CLOUD.left #amber [dependency]
DEPLOY.top -> FW.bottom #cyan [control-flow]
```

<!-- /schemd-section -->
