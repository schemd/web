<!-- schemd-doc: id=component-reference; label=Component API; title=Use every 0.3 primitive deliberately; summary=Exhaustive families, variants, options, semantic ports, and canonical orientations.; category=Author diagrams; order=40 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- A reference shows each primitive in isolation; wiring every example would obscure the symbol it demonstrates. -->

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

```schemd bounds="1040x440" title="Battery-fed reference oscillator"
source:V1 "12 V" at (100, 160) #blue [type=battery]
protection:F1 "2 A" at (280, 160) #amber [type=fuse]
resonator:X1 "16 MHz" at (470, 160) #cyan [type=crystal]
amplifier:U1 "opamp" at (680, 160) #purple [type=opamp]
load:LMP "lamp" at (890, 160) #emerald [type=lamp]
power:VSS "VSS" at (680, 330) #slate [type=vss orientation=up]

V1.positive -> F1.in #blue [line]
F1.out -> X1.in #amber [line]
X1.out -> U1.positive #cyan [line]
U1.out -> LMP.in #purple [line marker-end=arrow]
VSS.in -> U1.v- #slate [ortho]
```

An amplifier separates its signal terminals (`positive`, `negative`, `out`) from its rails (`v+`, `v-`), which is why the supply above attaches without pretending to be an input.

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
resistor:R1 "thermistor" at (100, 150) #amber [type=thermistor]
capacitor:C1 "C_{pol}" at (290, 150) #cyan [type=polarized orientation=up]
inductor:T1 "transformer" at (480, 150) #purple [type=transformer]
diode:D1 "zener" at (670, 150) #blue [type=zener orientation=left]
transistor:Q1 "n-IGBT" at (860, 150) #emerald [type=nigbt orientation=down]
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
bus:SPLIT "split" at (270, 260) #cyan [type=splitter width=8 outputs=2]
register:REG "R0" at (520, 150) #purple [width=8]
clock:CLK "CLK" at (520, 310) #amber
port:DOUT "Q[7:0]" at (850, 150) #emerald [width=8]
port:FLAG "D_0" at (80, 330) #cyan

DIN.out -> REG.in #blue [digital ortho width=8]
DIN.out -> SPLIT.bus #blue [digital ortho width=8]
SPLIT.out1 -> FLAG.in #cyan [digital ortho]
CLK.out -> REG.clock #amber [digital ortho]
REG.out -> DOUT.in #emerald [digital width=8]
```

A `bus` splitter is how one wide signal becomes several narrow ones without the width check losing its meaning: the `bus` port carries all eight bits, each indexed branch carries one.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=04 / Quantum; title=Named gates, two-track CNOT, multi-track operators, and classical results; example-title=Bell-state entangler -->

Single-qubit shells are `hadamard`, `qgate`, `xgate`, `ygate`, `zgate`, `sgate`, `sdg`, `tgate`, `tdg`, `sx`, `phase`, `rx`, `ry`, `rz`, and `ugate`; they use `in`/`out`. `qgate` accepts `parameter`, `phase`, and `matrix` detail rows.

| Kind                                                                | Stable ports and options                                                                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `cnot`                                                              | control rail `in1`, `out1`; target rail `in2`, `out2`; legacy aliases `in`, `out`, `control`, `target` remain accepted |
| `measure`                                                           | `in`, `out`, `classical`                                                                                               |
| `reset`                                                             | `in`, `out`                                                                                                            |
| `prepare`                                                           | `out`                                                                                                                  |
| `control`                                                           | `in`, `out`, `control`; `control=positive`, `negative`, or `classical`                                                 |
| `swap`, `cz`, `cphase`, `toffoli`, `controlled`, `barrier`, `delay` | indexed `inN`, `outN`, `controlN`, `targetN`; bounded `wires`, `controls`, `targets`                                   |
| `classical-bit`                                                     | `in`, `out`                                                                                                            |
| `classical-register`                                                | `in`, `out`, `width=2..256`                                                                                            |

`cnot` always owns exactly two continuous qubit rails. Use the indexed through-ports when composing a circuit; `control` and `target` address the marker locations for compatibility and interaction metadata. `initial` and `final` belong to UML state/activity diagrams—they are not quantum state boundaries. Start a quantum rail with `prepare`, and terminate it with `measure` or a system `port` when it remains unmeasured.

```schemd bounds="980x460" title="Teleportation entangler"
prepare:A "|\psi\rangle" at (90, 110) #blue
prepare:B "|0\rangle" at (90, 250) #blue
prepare:C "|0\rangle" at (90, 390) #blue
hadamard:H "H" at (300, 250) #cyan
cnot:E "CNOT" at (520, 320) #purple
swap:SW "SWAP" at (770, 190) #emerald

A.out -> SW.in1 #blue [quantum line]
B.out -> H.in #blue [quantum line]
H.out -> E.in1 #cyan [quantum line]
C.out -> E.in2 #blue [quantum line]
E.out1 -> SW.in2 #purple [quantum ortho]
```

`cnot` owns exactly two continuous rails — control in at `in1` and out at `out1`, target in at `in2` and out at `out2`. Use the indexed through-ports when composing; `control` and `target` remain accepted, but they address the marker positions rather than the rails.

<!-- /schemd-section -->

<!-- schemd-section: id=uml; eyebrow=05 / UML; title=Structural, deployment, activity, state, and interaction nodes; example-title=Deployment and activity model -->

The UML catalog includes:

- Structure: `class`, `interface`, `provided-interface`, `required-interface`, `enumeration`, `datatype`, `object`, `component`, `component-port`, `artifact`, `node`, `device`, `execution`, `system`, `package`, `note`.
- Behavior: `actor`, `usecase`, `state`, `action`, `decision`, `merge`, `fork`, `join`, `activity-final`, `flow-final`, `object-node`, `send-signal`, `receive-signal`, `partition`.
- Interaction/state: `lifeline`, `activation`, `destruction`, `fragment`, `interaction`, `gate`, `found`, `lost`, `choice`, `state-junction`, `history`, `entry`, `exit`, `terminate`, `region`, `initial`, `final`.

Sized rectangular nodes accept bounded `width` and `height`. Class-like nodes additionally accept `stereotype`, `attributes`, and `operations`. Their ports are `left`, `right`, `top`, and `bottom`.

Relations are `association`, `dependency`, `generalization`, `realization`, `aggregation`, `composition`, `message`, `synchronous`, `asynchronous`, `return`, `control-flow`, `object-flow`, `assembly`, `delegation`, `transition`, `include`, and `extend`.

```schemd bounds="1000x520" title="Calibration use cases and states"
actor:OPS "Operator" at (100, 240) #blue
usecase:CAL "Calibrate" at (330, 150) #cyan
usecase:LOG "Record run" at (330, 340) #purple
state:ARMED "Armed" at (640, 150) #amber [details="entry / zero; exit / latch"]
choice:CH "ok?" at (640, 340) #slate
final:END "done" at (880, 340) #emerald

OPS.right -> CAL.left #blue [line association]
CAL.bottom -> LOG.top #purple [ortho include]
CAL.right -> ARMED.left #amber [line transition label="start"]
LOG.right -> CH.left #slate [line transition]
CH.right -> END.left #emerald [line transition label="pass"]
```

Note that a relation name is only a connection option. Naming `include` or `transition` picks the marker and dash pattern the notation already expects, so we never hand-build one.

<!-- /schemd-section -->
