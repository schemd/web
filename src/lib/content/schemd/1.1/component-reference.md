<!-- schemd-doc: id=component-reference; label=Component API; title=Use every 1.1 primitive deliberately; summary=Exhaustive families, variants, options, semantic ports, and canonical orientations.; category=Author diagrams; order=40 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- A reference shows each primitive in isolation; wiring every example would obscure the symbol it demonstrates. -->

Every direction-sensitive family defaults to `orientation=right`; a rotationally symmetric node such as `junction` rejects the option outright. Aliases are still accepted, but the names in these tables are the ones the compiler emits — an alias is rewritten to its canonical terminal before anything downstream sees it, so these are the names a host must key on.

<!-- schemd-section: id=electrical; eyebrow=01 / Electrical; title=Sources, connectivity, switching, and instruments; example-title=Typed pump drive -->

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

```schemd bounds="1040x420" title="Fused pump drive"
connector:J5 "supply" at (90, 150) #slate
protection:FU5 "fuse" at (270, 150) #amber [type=fuse]
switch:S5 "start" at (460, 150) #cyan [type=pushbutton]
meter:V5 "V" at (660, 150) #purple [type=voltmeter]
load:P5 "pump" at (860, 150) #emerald [type=motor]
testpoint:TP5 "TP5" at (460, 310) #cyan

J5.out -> FU5.in #slate [line]
FU5.out -> S5.in #amber [line]
S5.out -> V5.in #cyan [line]
V5.out -> P5.in #emerald [line marker-end=arrow]
S5.out -> TP5.node #cyan [ortho]
```

A relay is two circuits in one symbol: `in`/`out` carry the load, `coil1`/`coil2` carry the control that closes it, so a relay never needs a second component to be honest about what switches it. The pushbutton above is the simpler case — one circuit, opened and closed by hand.

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

```schemd bounds="1040x430" title="More variants"
resistor:RL5 "LDR" at (100, 150) #amber [type=ldr]
capacitor:CV5 "variable" at (290, 150) #cyan [type=variable orientation=down]
inductor:TX5 "transformer" at (480, 150) #purple [type=transformer]
diode:DS5 "Schottky" at (670, 150) #blue [type=schottky]
transistor:QP5 "p-MOS" at (860, 150) #emerald [type=pmos orientation=up]
```

Note that the variant changes the symbol, never the port contract. An LDR and a fixed resistor are both wired `in` to `out`, so swapping one for the other is a one-word edit rather than a rewiring.

<!-- /schemd-section -->

<!-- schemd-section: id=digital; eyebrow=03 / Digital; title=Logic, sequential blocks, and explicit buses; example-title=Undervoltage lockout datapath -->

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

Every terminal of a digital block has a slot of its own: data inputs on the left, outputs on the right, clock, enable and select below, preset and clear above, and each has a lead drawn to it. Every block except `buffer`, `logic` and `clock` accepts [`fit=wires`](/docs/1.1/fit), which lines its left and right terminals up with their wires. A flip-flop accepts only its own variant's letters:

| Variant    | Inputs   | Below    | Above             |
| ---------- | -------- | -------- | ----------------- |
| `d`        | `d`      | `clock`  | `preset`, `clear` |
| `t`        | `t`      | `clock`  | `preset`, `clear` |
| `jk`       | `j`, `k` | `clock`  | `preset`          |
| `sr-latch` | `s`, `r` | `enable` | `preset`          |
| `d-latch`  | `d`      | `clock`  | `preset`          |

`j` on a D flip-flop is rejected with its line — 0.8 drew it on the first input, on top of `d`.

```schemd bounds="1140x560" title="Undervoltage lockout datapath"
port:VSN "V_{sense}" at (80, 130) #blue
port:VLO "V_{lo}" at (80, 250) #amber
comparator:CP5 "V ? lo" at (400, 190) #cyan
junction:UVL "under" at (650, 190) #cyan
mux:SEL5 "select" at (860, 190) #purple [type=mux]
flipflop:LT5 "hold" at (650, 420) #emerald [type=t]
clock:CLK5 "CLK" at (200, 420) #amber
port:LOCK "lockout" at (1050, 190) #emerald

VSN.out -> CP5.in1 #blue [digital ortho]
VLO.out -> CP5.in2 #amber [digital ortho]
CP5.lt -> UVL.node #cyan [digital ortho]
UVL.node -> SEL5.select #cyan [digital ortho]
UVL.node -> LT5.t #cyan [digital ortho]
CLK5.out -> LT5.clock #amber [digital ortho]
SEL5.out1 -> LOCK.in #emerald [digital ortho marker-end=arrow]
```

A comparator publishes three answers — `gt`, `eq`, `lt` — rather than one boolean, so a datapath that cares about _which_ way a threshold was crossed — here, falling below it on `lt` — does not need a second gate to find out.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=04 / Quantum; title=Named gates, two-track CNOT, multi-track operators, and classical results; example-title=Controlled-Z entangler -->

Single-qubit shells are `hadamard`, `qgate`, `xgate`, `ygate`, `zgate`, `sgate`, `sdg`, `tgate`, `tdg`, `sx`, `phase`, `rx`, `ry`, `rz`, and `ugate`; they use `in`/`out`. `qgate` accepts `parameter`, `phase`, and `matrix` detail rows.

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

`cnot` always owns exactly two continuous qubit rails. Use the indexed through-ports when composing a circuit; `control` and `target` address the marker locations for compatibility and interaction metadata. `initial` and `final` belong to UML state/activity diagrams—they are not quantum state boundaries. Start a quantum rail with `prepare`, and terminate it with `measure` or a system `port` when it remains unmeasured.

```schemd bounds="1000x520" title="Controlled-Z with classical readout"
prepare:Z0 "|1\rangle" at (80, 110) #blue
prepare:Z1 "|+\rangle" at (80, 250) #blue
prepare:Z2 "|0\rangle" at (80, 390) #blue
controlled:CCZ "CCZ" at (420, 250) #purple [controls=2 targets=1 operator=Z fit=wires]
measure:MZ5 "M_z" at (700, 390) #cyan
classical-bit:CZ5 "c_2" at (880, 390) #emerald

Z0.out -> CCZ.in1 #blue [quantum ortho]
Z1.out -> CCZ.in2 #blue [quantum ortho]
Z2.out -> CCZ.in3 #blue [quantum ortho]
CCZ.out3 -> MZ5.in #purple [quantum ortho]
MZ5.classical -> CZ5.in #cyan [classical line marker-end=arrow]
```

The rails are indexed and continuous: `inN` enters, `outN` leaves, and the operator sits across all of them. `measure` is the only place a quantum rail becomes classical, which is why its `classical` port — not its `out` — feeds the classical bit.

`cnot` is the two-track case of the same rule, and the one most often written wrongly. It owns exactly two continuous rails: the control enters at `in1` and leaves unchanged at `out1`, the target enters at `in2` and leaves at `out2`. The legacy `control` and `target` names still resolve — they address the marker positions — but a composed circuit should use the indexed through-ports, because those are the terminals the netlist and the full-mode metadata carry. Its rails sit 18 units apart unless we write [`fit=wires`](/docs/1.1/fit), which puts them on the qubits, as below.

```schemd bounds="900x340" title="Fitted CNOT rails"
prepare:FC "|1\rangle" at (90, 100) #blue
prepare:FT "|0\rangle" at (90, 260) #blue
cnot:CX "CNOT" at (450, 180) #purple [fit=wires]
port:FOC "control out" at (780, 100) #emerald
port:FOT "target out" at (780, 260) #emerald

FC.out -> CX.in1 #blue [quantum ortho]
FT.out -> CX.in2 #blue [quantum ortho]
CX.out1 -> FOC.in #purple [quantum ortho]
CX.out2 -> FOT.in #purple [quantum ortho marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=uml; eyebrow=05 / UML; title=Structural, deployment, activity, state, and interaction nodes; example-title=Deployment and activity model -->

The UML catalog includes:

- Structure: `class`, `interface`, `provided-interface`, `required-interface`, `enumeration`, `datatype`, `object`, `component`, `component-port`, `artifact`, `node`, `device`, `execution`, `system`, `package`, `note`.
- Behavior: `actor`, `usecase`, `state`, `action`, `decision`, `merge`, `fork`, `join`, `activity-final`, `flow-final`, `object-node`, `send-signal`, `receive-signal`, `partition`.
- Interaction/state: `lifeline`, `activation`, `destruction`, `fragment`, `interaction`, `gate`, `found`, `lost`, `choice`, `state-junction`, `history`, `entry`, `exit`, `terminate`, `region`, `initial`, `final`.

Sized rectangular nodes accept bounded `width` and `height`. Class-like nodes additionally accept `stereotype`, `attributes`, and `operations`. Their ports are `left`, `right`, `top`, and `bottom`.

Relations are `association`, `dependency`, `generalization`, `realization`, `aggregation`, `composition`, `message`, `synchronous`, `asynchronous`, `return`, `control-flow`, `object-flow`, `assembly`, `delegation`, `transition`, `include`, and `extend`.

```schemd bounds="1000x540" title="Docs publication interaction"
lifeline:CI5 "Docs job" at (220, 270) #cyan [width=170 height=400]
lifeline:CDN5 "CDN" at (620, 270) #amber [width=170 height=400]
artifact:SITE5 "build/" at (880, 110) #emerald [width=170 height=80]

CI5.right90 -> CDN5.left90 #cyan [line synchronous label="upload(1.1.0)"]
CDN5.left180 -> CI5.right180 #amber [line return dashed label="etag"]
CI5.right270 -> CDN5.left270 #cyan [line asynchronous label="purge cache"]
SITE5.bottom -> CDN5.top #emerald [ortho dependency label="static assets"]
```

A lifeline exposes `leftNN` and `rightNN`, placing a port exactly `NN` units below its top edge — which is what lets three messages sit at three exact heights without a layout engine deciding for us.

<!-- /schemd-section -->
