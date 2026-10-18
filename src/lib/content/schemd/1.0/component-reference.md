<!-- schemd-doc: id=component-reference; label=Component API; title=Use every 1.0 primitive deliberately; summary=Exhaustive families, variants, options, semantic ports, and canonical orientations.; category=Author diagrams; order=40 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- A reference shows each primitive in isolation; wiring every example would obscure the symbol it demonstrates. -->

Every direction-sensitive family defaults to `orientation=right`; a rotationally symmetric node such as `junction` rejects the option outright. Aliases are still accepted, but the names in these tables are the ones the compiler emits — an alias is rewritten to its canonical terminal before anything downstream sees it, so these are the names a host must key on.

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

```schemd bounds="1040x420" title="Breaker-fed heater"
connector:J4 "mains inlet" at (90, 150) #slate
protection:CB4 "breaker" at (270, 150) #amber [type=breaker]
switch:K4 "relay" at (460, 150) #cyan [type=relay]
meter:A4 "A" at (660, 150) #purple [type=ammeter]
load:H4 "heater" at (860, 150) #emerald [type=lamp]
testpoint:TP4 "TP4" at (460, 310) #cyan

J4.out -> CB4.in #slate [line]
CB4.out -> K4.in #amber [line]
K4.out -> A4.in #cyan [line]
A4.out -> H4.in #emerald [line marker-end=arrow]
K4.out -> TP4.node #cyan [ortho]
```

A relay is two circuits in one symbol: `in`/`out` carry the load, `coil1`/`coil2` carry the control that closes it. That separation is why the relay above needs no second component to be honest about what switches it.

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
resistor:RT4 "thermistor" at (100, 150) #amber [type=thermistor]
capacitor:CP4 "polarized" at (290, 150) #cyan [type=polarized orientation=down]
inductor:LC4 "coupled" at (480, 150) #purple [type=coupled]
diode:DZ4 "Zener" at (670, 150) #blue [type=zener]
transistor:QJ4 "n-JFET" at (860, 150) #emerald [type=njfet orientation=up]
```

Note that the variant changes the symbol, never the port contract. A thermistor and a fixed resistor are both wired `in` to `out`, so swapping one for the other is a one-word edit rather than a rewiring.

<!-- /schemd-section -->

<!-- schemd-section: id=digital; eyebrow=03 / Digital; title=Logic, sequential blocks, and explicit buses; example-title=Overcurrent latch datapath -->

Classical gates are `and`, `or`, `not`, `nand`, `nor`, `xor`, and `xnor`; they use indexed `in1..inN`, `out1..outN` and accept `standard=ieee|iec`.

| Kind                 | `type` variants                                                         | Stable special ports                                              |
| -------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `buffer`             | `plain`, `tristate`, `tristate-inverter`, `schmitt`, `schmitt-inverter` | `in1`, `out1`; tri-state adds `enable`                            |
| `logic`              | `high`, `low`, `unknown`, `high-z`                                      | `out`                                                             |
| `clock`              | —                                                                       | `out`                                                             |
| `flipflop`           | `sr-latch`, `d-latch`, `d`, `jk`, `t`                                   | `q`, `nq`, `preset`; each variant's own inputs (below)            |
| `mux`                | `mux`, `demux`                                                          | indexed data ports, `select`, `enable`                            |
| `encoder`, `decoder` | —                                                                       | indexed inputs/outputs                                            |
| `register`           | —                                                                       | `in`, `in2…`, `out`, `out2…`, `clock`, `enable`, `clear`; `width` |
| `counter`            | —                                                                       | indexed output, `clock`, `enable`, `clear`                        |
| `adder`              | `half`, `full`                                                          | indexed inputs/outputs                                            |
| `comparator`         | —                                                                       | `in1`, `in2`, `gt`, `eq`, `lt`                                    |
| `bus`                | `tap`, `splitter`, `joiner`                                             | `bus`, `tap`, or indexed branches; `width=2..256`                 |

Every terminal of a digital block has a slot of its own: data inputs on the left, outputs on the right, clock, enable and select below, preset and clear above, and each has a lead drawn to it. A flip-flop accepts only its own variant's letters:

| Variant    | Inputs   | Below    | Above             |
| ---------- | -------- | -------- | ----------------- |
| `d`        | `d`      | `clock`  | `preset`, `clear` |
| `t`        | `t`      | `clock`  | `preset`, `clear` |
| `jk`       | `j`, `k` | `clock`  | `preset`          |
| `sr-latch` | `s`, `r` | `enable` | `preset`          |
| `d-latch`  | `d`      | `clock`  | `preset`          |

`j` on a D flip-flop is rejected with its line — 0.8 drew it on the first input, on top of `d`.

```schemd bounds="1140x560" title="Overcurrent latch datapath"
port:ISNS "I_{sense}" at (80, 130) #blue
port:ITRIP "I_{trip}" at (80, 250) #amber
comparator:CP4 "I ? trip" at (400, 190) #cyan
junction:OVR "over" at (650, 190) #cyan
mux:SEL "select" at (860, 190) #purple [type=mux]
flipflop:LAT "latch" at (650, 420) #emerald [type=d]
clock:CLK4 "CLK" at (200, 420) #amber
port:SHDN "shutdown" at (1050, 190) #emerald

ISNS.out -> CP4.in1 #blue [digital ortho]
ITRIP.out -> CP4.in2 #amber [digital ortho]
CP4.gt -> OVR.node #cyan [digital ortho]
OVR.node -> SEL.select #cyan [digital ortho]
OVR.node -> LAT.d #cyan [digital ortho]
CLK4.out -> LAT.clock #amber [digital ortho]
SEL.out1 -> SHDN.in #emerald [digital ortho marker-end=arrow]
```

A comparator publishes three answers — `gt`, `eq`, `lt` — rather than one boolean, so a datapath that cares about _which_ way a threshold was crossed does not need a second gate to find out.

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

```schemd bounds="1000x520" title="Toffoli with classical readout"
prepare:B0 "|1\rangle" at (80, 110) #blue
prepare:B1 "|0\rangle" at (80, 250) #blue
prepare:B2 "|1\rangle" at (80, 390) #blue
toffoli:CCX "CCX" at (420, 250) #purple [controls=2 targets=1]
measure:MQ4 "M_z" at (700, 390) #cyan
classical-bit:CQ4 "c_2" at (880, 390) #emerald

B0.out -> CCX.in1 #blue [quantum line]
B1.out -> CCX.in2 #blue [quantum line]
B2.out -> CCX.in3 #blue [quantum line]
CCX.out3 -> MQ4.in #purple [quantum line]
MQ4.classical -> CQ4.in #cyan [classical line marker-end=arrow]
```

The rails are indexed and continuous: `inN` enters, `outN` leaves, and the operator sits across all of them. `measure` is the only place a quantum rail becomes classical, which is why its `classical` port — not its `out` — feeds the classical bit.

`cnot` is the two-track case of the same rule, and the one most often written wrongly. It owns exactly two continuous rails: the control enters at `in1` and leaves unchanged at `out1`, the target enters at `in2` and leaves at `out2`. The legacy `control` and `target` names still resolve — they address the marker positions — but a composed circuit should use the indexed through-ports, because those are the terminals the netlist and the full-mode metadata carry.

```schemd bounds="900x340" title="Indexed CNOT rails"
prepare:QC "|+\rangle" at (90, 110) #blue
prepare:QT "|0\rangle" at (90, 250) #blue
cnot:CX "CNOT" at (450, 180) #purple
port:OC "control out" at (780, 110) #emerald
port:OT "target out" at (780, 250) #emerald

QC.out -> CX.in1 #blue [quantum line]
QT.out -> CX.in2 #blue [quantum line]
CX.out1 -> OC.in #purple [quantum line]
CX.out2 -> OT.in #purple [quantum line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=uml; eyebrow=05 / UML; title=Structural, deployment, activity, state, and interaction nodes; example-title=Deployment and activity model -->

The UML catalog includes:

- Structure: `class`, `interface`, `provided-interface`, `required-interface`, `enumeration`, `datatype`, `object`, `component`, `component-port`, `artifact`, `node`, `device`, `execution`, `system`, `package`, `note`.
- Behavior: `actor`, `usecase`, `state`, `action`, `decision`, `merge`, `fork`, `join`, `activity-final`, `flow-final`, `object-node`, `send-signal`, `receive-signal`, `partition`.
- Interaction/state: `lifeline`, `activation`, `destruction`, `fragment`, `interaction`, `gate`, `found`, `lost`, `choice`, `state-junction`, `history`, `entry`, `exit`, `terminate`, `region`, `initial`, `final`.

Sized rectangular nodes accept bounded `width` and `height`. Class-like nodes additionally accept `stereotype`, `attributes`, and `operations`. Their ports are `left`, `right`, `top`, and `bottom`.

Relations are `association`, `dependency`, `generalization`, `realization`, `aggregation`, `composition`, `message`, `synchronous`, `asynchronous`, `return`, `control-flow`, `object-flow`, `assembly`, `delegation`, `transition`, `include`, and `extend`.

```schemd bounds="1000x540" title="Release publication interaction"
lifeline:CI4 "Release job" at (220, 270) #cyan [width=170 height=400]
lifeline:NPM4 "npm" at (620, 270) #amber [width=170 height=400]
artifact:NOTES4 "CHANGELOG.md" at (880, 110) #emerald [width=170 height=80]

CI4.right90 -> NPM4.left90 #cyan [line synchronous label="publish(1.0.0)"]
NPM4.left180 -> CI4.right180 #amber [line return dashed label="provenance"]
CI4.right270 -> NPM4.left270 #cyan [line asynchronous label="tag release"]
NOTES4.bottom -> NPM4.top #emerald [ortho dependency label="release notes"]
```

A lifeline exposes `leftNN` and `rightNN`, placing a port exactly `NN` units below its top edge — which is what lets three messages sit at three exact heights without a layout engine deciding for us.

<!-- /schemd-section -->
