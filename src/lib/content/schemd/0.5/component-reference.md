<!-- schemd-doc: id=component-reference; label=Component API; title=Use every 0.5 primitive deliberately; summary=Exhaustive families, variants, options, semantic ports, and canonical orientations.; category=Author diagrams; order=40 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- A reference shows each primitive in isolation; wiring every example would obscure the symbol it demonstrates. -->

Every direction-sensitive family defaults to `orientation=right`; a rotationally symmetric node such as `junction` rejects the option outright. Aliases are still accepted, but the names in these tables are the ones 0.5 emits — an alias is rewritten to its canonical terminal before anything downstream sees it, so these are the names a host must key on.

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

```schemd bounds="1040x420" title="Relay-switched motor drive"
connector:J1 "mains in" at (90, 150) #slate
protection:CB1 "breaker" right-of J1 by 90 #amber [type=breaker]
switch:K1 "contactor" right-of CB1 by 100 #cyan [type=relay]
meter:M1 "A" right-of K1 by 100 #purple [type=ammeter]
load:MOT "motor" right-of M1 by 100 #emerald [type=motor]
testpoint:TP1 "TP1" below M1 by 90 aligned-x with M1 #cyan

J1.out -> CB1.in #slate [line]
CB1.out -> K1.in #amber [line]
K1.out -> M1.in #cyan [line]
M1.out -> MOT.in #emerald [line marker-end=arrow]
M1.out -> TP1.node #cyan [ortho]
```

A relay is two circuits in one symbol: `in`/`out` carry the load, `coil1`/`coil2` carry the control that closes it. That separation is why the contactor above needs no second component to be honest about what switches it.

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
resistor:R1 "wiper" at (100, 150) #amber [type=potentiometer]
capacitor:C1 "trimmer" right-of R1 by 110 #cyan [type=variable orientation=down]
inductor:L1 "coupled" right-of C1 by 110 #purple [type=coupled]
diode:D1 "triac" right-of L1 by 110 #blue [type=triac]
transistor:Q1 "p-JFET" right-of D1 by 110 #emerald [type=pjfet orientation=up]
```

Note that the variant changes the symbol, never the port contract. A potentiometer and a fixed resistor are both wired `in` to `out`, so swapping one for the other is a one-word edit rather than a rewiring.

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

```schemd bounds="1140x520" title="Threshold comparator datapath"
port:SAMPLE "sample" at (80, 130) #blue
port:LIMIT "limit" below SAMPLE by 60 aligned-x with SAMPLE #amber
comparator:CMP "sample ? limit" right-of SAMPLE by 200 #cyan
junction:OVER "over" right-of CMP by 130 #cyan
mux:SEL "select" right-of OVER by 130 #purple [type=mux]
counter:CNT "overruns" below OVER by 150 aligned-x with OVER #emerald
clock:CLK "CLK" left-of CNT by 260 #amber
port:RESULT "result" right-of SEL by 120 #emerald

SAMPLE.out -> CMP.in1 #blue [digital line]
LIMIT.out -> CMP.in2 #amber [digital line]
CMP.gt -> OVER.node #cyan [digital line]
OVER.node -> SEL.select #cyan [digital ortho]
OVER.node -> CNT.in1 #cyan [digital line]
CLK.out -> CNT.clock #amber [digital ortho]
SEL.out -> RESULT.in #emerald [digital line marker-end=arrow]
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
prepare:C0 "|1\rangle" at (80, 110) #blue
prepare:C1 "|1\rangle" below C0 by 80 aligned-x with C0 #blue
prepare:T0 "|0\rangle" below C1 by 80 aligned-x with C1 #blue
toffoli:CCX "CCX" right-of C1 by 220 #purple [controls=2 targets=1]
measure:MT "M" right-of CCX by 150 aligned-y with T0 #cyan
classical-bit:CB "c_0" right-of MT by 110 #emerald

C0.out -> CCX.in1 #blue [quantum line]
C1.out -> CCX.in2 #blue [quantum line]
T0.out -> CCX.in3 #blue [quantum line]
CCX.out3 -> MT.in #purple [quantum line]
MT.classical -> CB.in #cyan [classical line marker-end=arrow]
```

The rails are indexed and continuous: `inN` enters, `outN` leaves, and the operator sits across all of them. `measure` is the only place a quantum rail becomes classical, which is why its `classical` port — not its `out` — feeds the classical bit.

`cnot` is the two-track case of the same rule, and the one most often written wrongly. It owns exactly two continuous rails: the control enters at `in1` and leaves unchanged at `out1`, the target enters at `in2` and leaves at `out2`. The legacy `control` and `target` names still resolve — they address the marker positions — but a composed circuit should use the indexed through-ports, because those are the terminals the netlist and the full-mode metadata carry.

```schemd bounds="900x340" title="Indexed CNOT rails"
prepare:Q0 "|+\rangle" at (90, 110) #blue
prepare:Q1 "|0\rangle" below Q0 by 40 aligned-x with Q0 #blue
cnot:CX "CNOT" right-of Q0 by 230 aligned-y with Q1 #purple
port:R0 "control out" right-of CX by 190 aligned-y with Q0 #emerald
port:R1 "target out" below R0 by 40 aligned-x with R0 #emerald

Q0.out -> CX.in1 #blue [quantum line]
Q1.out -> CX.in2 #blue [quantum line]
CX.out1 -> R0.in #purple [quantum line]
CX.out2 -> R1.in #purple [quantum line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=uml; eyebrow=05 / UML; title=Structural, deployment, activity, state, and interaction nodes; example-title=Deployment and activity model -->

The UML catalog includes:

- Structure: `class`, `interface`, `provided-interface`, `required-interface`, `enumeration`, `datatype`, `object`, `component`, `component-port`, `artifact`, `node`, `device`, `execution`, `system`, `package`, `note`.
- Behavior: `actor`, `usecase`, `state`, `action`, `decision`, `merge`, `fork`, `join`, `activity-final`, `flow-final`, `object-node`, `send-signal`, `receive-signal`, `partition`.
- Interaction/state: `lifeline`, `activation`, `destruction`, `fragment`, `interaction`, `gate`, `found`, `lost`, `choice`, `state-junction`, `history`, `entry`, `exit`, `terminate`, `region`, `initial`, `final`.

Sized rectangular nodes accept bounded `width` and `height`. Class-like nodes additionally accept `stereotype`, `attributes`, and `operations`. Their ports are `left`, `right`, `top`, and `bottom`.

Relations are `association`, `dependency`, `generalization`, `realization`, `aggregation`, `composition`, `message`, `synchronous`, `asynchronous`, `return`, `control-flow`, `object-flow`, `assembly`, `delegation`, `transition`, `include`, and `extend`.

```schemd bounds="1000x540" title="Firmware rollout interaction"
lifeline:FLEET "Fleet service" at (220, 270) #blue [width=170 height=400]
lifeline:DEVICE "Edge device" right-of FLEET by 230 aligned-y with FLEET #purple [width=170 height=400]
artifact:IMG "firmware.bin" at (880, 110) #amber [width=170 height=80]

FLEET.right90 -> DEVICE.left90 #blue [line synchronous label="offer(v0.5.0)"]
DEVICE.left180 -> FLEET.right180 #purple [line return dashed label="accepted"]
FLEET.right270 -> DEVICE.left270 #blue [line asynchronous label="stream image"]
IMG.bottom -> DEVICE.top #amber [ortho dependency label="manifest"]
```

A lifeline exposes `leftNN` and `rightNN`, placing a port exactly `NN` units below its top edge — which is what lets three messages sit at three exact heights without a layout engine deciding for us.

<!-- /schemd-section -->
