<!-- schemd-doc: id=component-reference; label=Component API; title=Use every 1.2 primitive deliberately; summary=Exhaustive families, variants, options, semantic ports, and canonical orientations.; category=Author diagrams; order=40 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- A reference shows each primitive in isolation; wiring every example would obscure the symbol it demonstrates. -->

Every family that has a direction defaults to `orientation=right`. A node that looks the same in every direction, such as `junction`, rejects the option outright. Aliases are still accepted, but the names in these tables are the ones the compiler emits. An alias is rewritten to its canonical terminal before anything downstream sees it, so these are the names a host must key on. Every kind accepts a declaration without a label, and such a part draws its designator alone.

<!-- schemd-section: id=electrical; eyebrow=01 / Electrical; title=Sources, connectivity, switching, and instruments; example-title=Metered lamp circuit -->

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

```schemd bounds="1040x420" title="Metered lamp circuit"
connector:J6 "mains" at (90, 150) #slate
protection:CB6 "breaker" at (270, 150) #amber [type=breaker]
switch:S6 "run" at (460, 150) #cyan [type=spst]
meter:A6 "A" at (660, 150) #purple [type=ammeter]
load:L6 "lamp" at (860, 150) #emerald [type=lamp]
testpoint:TP6 at (460, 310) #cyan

J6.out -> CB6.in #slate [line]
CB6.out -> S6.in #amber [line]
S6.out -> A6.in #cyan [line]
A6.out -> L6.in #emerald [line marker-end=arrow]
S6.out -> TP6.node #cyan [ortho]
```

A relay is two circuits in one symbol. `in` and `out` carry the load, and `coil1` and `coil2` carry the control that closes it, so a relay never needs a second component to show what switches it. The `spst` switch above is the simpler case: one circuit, opened and closed by hand. Its test point carries no label, because the designator already names it.

<!-- /schemd-section -->

<!-- schemd-section: id=passives-semiconductors; eyebrow=02 / Electrical; title=Passives and semiconductor variants; example-title=Five more variants -->

Passives share `in` and `out`, and diodes expose `anode` and `cathode`. A transistor is controlled at `base` for a BJT and at `gate` for a FET or IGBT. Its other terminals are `collector` and `emitter`, or `drain` and `source`.

| Kind         | Variants                                                                         |
| ------------ | -------------------------------------------------------------------------------- |
| `resistor`   | `fixed`, `variable`, `rheostat`, `potentiometer`, `thermistor`, `ldr`            |
| `capacitor`  | `fixed`, `variable`, `polarized`                                                 |
| `inductor`   | `fixed`, `coupled`, `transformer`                                                |
| `diode`      | `standard`, `schottky`, `zener`, `led`, `photodiode`, `varactor`, `scr`, `triac` |
| `transistor` | `npn`, `pnp`, `nmos`, `pmos`, `njfet`, `pjfet`, `nigbt`, `pigbt`                 |
| `port`       | optional `width=1..256`; `in`, `out`                                             |
| `ground`     | `signal`, `earth`, `chassis`; `in`                                               |

```schemd bounds="1040x430" title="Five more variants"
resistor:RP6 "trim" at (100, 150) #amber [type=potentiometer]
capacitor:CP6 "polarized" at (290, 150) #cyan [type=polarized orientation=down]
inductor:LC6 "coupled" at (480, 150) #purple [type=coupled]
diode:DZ6 "Zener" at (670, 150) #blue [type=zener]
transistor:QJ6 "n-JFET" at (860, 150) #emerald [type=njfet orientation=up]
```

A variant changes the symbol and never the port contract. A potentiometer and a fixed resistor are both wired from `in` to `out`. Swapping one for the other is therefore a one-word edit, with no rewiring.

<!-- /schemd-section -->

<!-- schemd-section: id=digital; eyebrow=03 / Digital; title=Logic, sequential blocks, and explicit buses; example-title=Overtemperature alarm datapath -->

The classical gates are `and`, `or`, `not`, `nand`, `nor`, `xor` and `xnor`. They use indexed `in1..inN` and `out1..outN`, and they accept `standard=ieee|iec`.

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

Every terminal of a digital block has a slot of its own. Data inputs sit on the left and outputs on the right. Clock, enable and select sit below, preset and clear above, and each one has a lead drawn to it. Every block except `buffer`, `logic` and `clock` accepts [`fit=wires`](/docs/1.2/fit), which lines its left and right terminals up with their wires. A flip-flop accepts only the letters of its own variant:

| Variant    | Inputs   | Below    | Above             |
| ---------- | -------- | -------- | ----------------- |
| `d`        | `d`      | `clock`  | `preset`, `clear` |
| `t`        | `t`      | `clock`  | `preset`, `clear` |
| `jk`       | `j`, `k` | `clock`  | `preset`          |
| `sr-latch` | `s`, `r` | `enable` | `preset`          |
| `d-latch`  | `d`      | `clock`  | `preset`          |

`j` on a D flip-flop is rejected with its line. In 0.8 it was drawn on the first input, on top of `d`.

```schemd bounds="1140x560" title="Overtemperature alarm datapath"
port:TSN "T_{sense}" at (80, 130) #blue
port:TMX "T_{max}" at (80, 250) #amber
comparator:CT6 "T ? max" at (400, 190) #cyan
junction:HOT "hot" at (650, 190) #cyan
buffer:BS6 "filter" at (860, 190) #purple [type=schmitt]
flipflop:LD6 "latch" at (650, 420) #emerald [type=d]
clock:CK6 "CLK" at (200, 420) #amber
port:ALM "alarm" at (1050, 190) #emerald

TSN.out -> CT6.in1 #blue [digital ortho]
TMX.out -> CT6.in2 #amber [digital ortho]
CT6.gt -> HOT.node #cyan [digital ortho]
HOT.node -> BS6.in1 #cyan [digital ortho]
HOT.node -> LD6.d #cyan [digital ortho]
CK6.out -> LD6.clock #amber [digital ortho]
BS6.out1 -> ALM.in #emerald [digital ortho marker-end=arrow]
```

A comparator publishes three answers, `gt`, `eq` and `lt`, where a single boolean would hide the direction. A datapath that cares which way a threshold was crossed therefore needs no second gate. Here the alarm follows `gt`, so it fires only above the limit.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=04 / Quantum; title=Named gates, two-track CNOT, multi-track operators, and classical results; example-title=Toffoli with classical readout -->

The single-qubit shells are `hadamard`, `qgate`, `xgate`, `ygate`, `zgate`, `sgate`, `sdg`, `tgate`, `tdg`, `sx`, `phase`, `rx`, `ry`, `rz` and `ugate`. They use `in` and `out`, and `qgate` accepts `parameter`, `phase` and `matrix` detail rows.

| Kind                                                                | Stable ports and options                                                                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cnot`                                                              | control rail `in1`, `out1`; target rail `in2`, `out2`; legacy aliases `in`, `out`, `control`, `target` remain accepted; `fit=wires`                    |
| `measure`                                                           | `in`, `out`, `classical`                                                                                                                               |
| `reset`                                                             | `in`, `out`                                                                                                                                            |
| `prepare`                                                           | `out`                                                                                                                                                  |
| `control`                                                           | `in`, `out`, `control`; `control=positive`, `negative`, or `classical`                                                                                 |
| `swap`, `cz`, `cphase`, `toffoli`, `controlled`, `barrier`, `delay` | indexed `inN`, `outN`, `controlN`, `targetN`; bounded `wires`, `controls`, `targets`; `fit=wires`; the vertical terminal on the lowest rail faces down |
| `classical-bit`                                                     | `in`, `out`                                                                                                                                            |
| `classical-register`                                                | `in`, `out`, `width=2..256`                                                                                                                            |

`cnot` always owns exactly two continuous qubit rails. A composed circuit should use the indexed through-ports. `control` and `target` address the marker locations, for compatibility and for interaction metadata. `initial` and `final` belong to UML state and activity diagrams, and they do not mark quantum state boundaries. A quantum rail starts with `prepare` and ends with `measure`, or with a system `port` when it stays unmeasured.

```schemd bounds="1000x520" title="Toffoli with classical readout"
prepare:T0 "|1\rangle" at (80, 110) #blue
prepare:T1 "|1\rangle" at (80, 250) #blue
prepare:T2 "|0\rangle" at (80, 390) #blue
toffoli:CCX6 "CCX" at (420, 250) #purple [fit=wires]
measure:MT6 "M_z" at (700, 390) #cyan
classical-bit:CT6B "c_2" at (880, 390) #emerald

T0.out -> CCX6.in1 #blue [quantum ortho]
T1.out -> CCX6.in2 #blue [quantum ortho]
T2.out -> CCX6.in3 #blue [quantum ortho]
CCX6.out3 -> MT6.in #purple [quantum ortho]
MT6.classical -> CT6B.in #cyan [classical line marker-end=arrow]
```

The rails are indexed and continuous. `inN` enters, `outN` leaves, and the operator sits across all of them. `measure` is the only place where a quantum rail becomes classical. Hence its `classical` port feeds the classical bit, while its `out` would carry the qubit onwards.

`cnot` is the two-track case of the same rule, and the one most often written wrongly. It owns exactly two continuous rails. The control enters at `in1` and leaves unchanged at `out1`; the target enters at `in2` and leaves at `out2`. The legacy names `control` and `target` still resolve to the marker positions. A composed circuit should still use the indexed through-ports, because the netlist and the `full`-mode metadata carry those terminals. The rails sit 18 units apart unless [`fit=wires`](/docs/1.2/fit) is written, and with it they sit on the qubits, as below.

```schemd bounds="900x340" title="Fitted CNOT, Bell pair"
prepare:GC "|+\rangle" at (90, 110) #blue
prepare:GT "|0\rangle" at (90, 250) #blue
cnot:CX at (440, 180) #purple [fit=wires]
port:GOC "control" at (770, 110) #emerald
port:GOT "target" at (770, 250) #emerald

GC.out -> CX.in1 #blue [quantum ortho]
GT.out -> CX.in2 #blue [quantum ortho]
CX.out1 -> GOC.in #purple [quantum ortho]
CX.out2 -> GOT.in #purple [quantum ortho marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=uml; eyebrow=05 / UML; title=Structural, deployment, activity, state, and interaction nodes; example-title=Package publication interaction -->

The UML catalogue has three groups.

- The structural kinds are `class`, `interface`, `provided-interface`, `required-interface`, `enumeration`, `datatype`, `object`, `component`, `component-port`, `artifact`, `node`, `device`, `execution`, `system`, `package` and `note`.
- The behavioural kinds are `actor`, `usecase`, `state`, `action`, `decision`, `merge`, `fork`, `join`, `activity-final`, `flow-final`, `object-node`, `send-signal`, `receive-signal` and `partition`.
- The interaction and state kinds are `lifeline`, `activation`, `destruction`, `fragment`, `interaction`, `gate`, `found`, `lost`, `choice`, `state-junction`, `history`, `entry`, `exit`, `terminate`, `region`, `initial` and `final`.

Sized rectangular nodes accept a bounded `width` and `height`. Class-like nodes also accept `stereotype`, `attributes` and `operations`. Their ports are `left`, `right`, `top` and `bottom`.

The relations are `association`, `dependency`, `generalization`, `realization`, `aggregation`, `composition`, `message`, `synchronous`, `asynchronous`, `return`, `control-flow`, `object-flow`, `assembly`, `delegation`, `transition`, `include` and `extend`.

```schemd bounds="1000x540" title="Package publication interaction"
lifeline:RJ6 "Release job" at (220, 270) #cyan [width=170 height=400]
lifeline:NPM6 "npm registry" at (620, 270) #amber [width=170 height=400]
artifact:PKG6 "dist/" at (880, 420) #emerald [width=170 height=80]

RJ6.right90 -> NPM6.left90 #cyan [line synchronous label="publish(1.2.0)"]
NPM6.left180 -> RJ6.right180 #amber [line return dashed label="201 Created"]
RJ6.right270 -> NPM6.left270 #cyan [line asynchronous label="attest provenance"]
PKG6.left -> NPM6.right350 #emerald [ortho dependency label="tarball"]
```

A lifeline exposes `leftNN` and `rightNN`, which place a port exactly `NN` units below its top edge. That is how three messages sit at three exact heights without a layout engine deciding for us, and how the tarball's dependency meets the registry at 350 units.

<!-- /schemd-section -->
