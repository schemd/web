<!-- schemd-doc: id=component-reference; label=Component API; title=Use every 1.3 primitive deliberately; summary=Exhaustive families, variants, options, semantic ports, and canonical orientations.; category=Author diagrams; order=40 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- A reference shows each primitive in isolation; wiring every example would obscure the symbol it demonstrates. -->

Every family that has a direction defaults to `orientation=right`. A node that looks the same in every direction, such as `junction`, rejects the option outright. Aliases are still accepted, but the names in these tables are the ones the compiler emits. An alias is rewritten to its canonical terminal before anything downstream sees it, so these are the names a host must key on. Every kind accepts a declaration without a label, and such a part draws its designator alone. Each kind also has a [datasheet](/components) on this site, printed from the compiler's own description of it.

<!-- schemd-section: id=electrical; eyebrow=01 / Electrical; title=Sources, connectivity, switching, and instruments; example-title=Relay fan drive -->

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

```schemd bounds="1040x430" title="Relay fan drive"
connector:J7 "12 V" at (90, 150) #slate
protection:FU7 "fuse" at (270, 150) #amber [type=fuse]
switch:K7 "relay" at (470, 150) #cyan [type=relay]
meter:V7 "V" at (670, 150) #purple [type=voltmeter]
load:M7 "fan" at (870, 150) #emerald [type=motor]
testpoint:TP7 at (470, 330) #cyan

J7.out -> FU7.in #slate [line]
FU7.out -> K7.in #amber [line]
K7.out -> V7.in #cyan [line]
V7.out -> M7.in #emerald [line marker-end=arrow]
K7.coil1 -> TP7.node #cyan [ortho]
```

A relay is two circuits in one symbol. `in` and `out` carry the load, and `coil1` and `coil2` carry the control that closes it, so a relay never needs a second component to show what switches it. The relay above switches the fan, and its `coil1` terminal is brought out to a test point. That test point carries no label, because the designator already names it.

<!-- /schemd-section -->

<!-- schemd-section: id=passives-semiconductors; eyebrow=02 / Electrical; title=Passives and semiconductor variants; example-title=Five further variants -->

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

```schemd bounds="1040x430" title="Five further variants"
resistor:RH7 "rheostat" at (100, 150) #amber [type=rheostat]
capacitor:CV7 "variable" at (290, 150) #cyan [type=variable orientation=down]
inductor:TX7 "transformer" at (480, 150) #purple [type=transformer]
diode:DV7 "varactor" at (670, 150) #blue [type=varactor]
transistor:QG7 "p-IGBT" at (860, 150) #emerald [type=pigbt orientation=up]
```

A variant changes the symbol and never the port contract. A rheostat and a fixed resistor are both wired from `in` to `out`. Swapping one for the other is therefore a one-word edit, with no rewiring.

<!-- /schemd-section -->

<!-- schemd-section: id=digital; eyebrow=03 / Digital; title=Logic, sequential blocks, and explicit buses; example-title=Batch counter datapath -->

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

Every terminal of a digital block has a slot of its own. Data inputs sit on the left and outputs on the right. Clock, enable and select sit below, preset and clear above, and each one has a lead drawn to it. Every block except `buffer`, `logic` and `clock` accepts [`fit=wires`](/docs/1.3/fit), which lines its left and right terminals up with their wires. A flip-flop accepts only the letters of its own variant:

| Variant    | Inputs   | Below    | Above             |
| ---------- | -------- | -------- | ----------------- |
| `d`        | `d`      | `clock`  | `preset`, `clear` |
| `t`        | `t`      | `clock`  | `preset`, `clear` |
| `jk`       | `j`, `k` | `clock`  | `preset`          |
| `sr-latch` | `s`, `r` | `enable` | `preset`          |
| `d-latch`  | `d`      | `clock`  | `preset`          |

`j` on a D flip-flop is rejected with its line. In 0.8 it was drawn on the first input, on top of `d`.

```schemd bounds="1140x460" title="Batch counter datapath"
port:PULSE "pulses" at (80, 130) #blue
buffer:SH7 "clean" at (280, 130) #cyan [type=schmitt]
counter:CT7 "count" at (500, 150) #amber
port:LIM "limit" at (80, 330) #amber
comparator:CM7 "N = limit" at (760, 250) #purple
port:DONE "batch done" at (1040, 250) #emerald

PULSE.out -> SH7.in1 #blue [digital ortho]
SH7.out1 -> CT7.clock #cyan [digital ortho]
CT7.out1 -> CM7.in1 #amber [digital ortho]
LIM.out -> CM7.in2 #amber [digital ortho]
CM7.eq -> DONE.in #emerald [digital ortho marker-end=arrow]
```

A comparator publishes three answers, `gt`, `eq` and `lt`, where a single boolean would hide the direction. A datapath that cares which way a threshold was crossed therefore needs no second gate. Here the batch signal follows `eq`, so it rises when the count reaches the limit.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=04 / Quantum; title=Named gates, two-track CNOT, multi-track operators, and classical results; example-title=Controlled phase with readout -->

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

```schemd bounds="1000x400" title="Controlled phase with readout"
prepare:P0 "|+\rangle" at (80, 120) #blue
prepare:P1 "|1\rangle" at (80, 280) #blue
cphase:CP7 "CP" at (400, 200) #purple [fit=wires]
measure:MX7 "M_x" at (680, 120) #cyan
classical-bit:CB7 "c_0" at (880, 120) #emerald

P0.out -> CP7.in1 #blue [quantum ortho]
P1.out -> CP7.in2 #blue [quantum ortho]
CP7.out1 -> MX7.in #purple [quantum ortho]
MX7.classical -> CB7.in #cyan [classical line marker-end=arrow]
```

The rails are indexed and continuous. `inN` enters, `outN` leaves, and the operator sits across all of them. `measure` is the only place where a quantum rail becomes classical. Hence its `classical` port feeds the classical bit, while its `out` would carry the qubit onwards.

`cnot` is the two-track case of the same rule, and the one most often written wrongly. It owns exactly two continuous rails. The control enters at `in1` and leaves unchanged at `out1`; the target enters at `in2` and leaves at `out2`. The legacy names `control` and `target` still resolve to the marker positions. A composed circuit should still use the indexed through-ports, because the netlist and the `full`-mode metadata carry those terminals. The rails sit 18 units apart unless [`fit=wires`](/docs/1.3/fit) is written, and with it they sit on the qubits, as below.

```schemd bounds="920x360" title="Fitted CNOT, both qubits set"
prepare:HC "|1\rangle" at (100, 100) #blue
prepare:HT "|1\rangle" at (100, 270) #blue
cnot:CX at (460, 185) #purple [fit=wires]
port:HOC "control out" at (790, 100) #emerald
port:HOT "target out" at (790, 270) #emerald

HC.out -> CX.in1 #blue [quantum ortho]
HT.out -> CX.in2 #blue [quantum ortho]
CX.out1 -> HOC.in #purple [quantum ortho]
CX.out2 -> HOT.in #purple [quantum ortho marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=uml; eyebrow=05 / UML; title=Structural, deployment, activity, state, and interaction nodes; example-title=Documentation deploy interaction -->

The UML catalogue has three groups.

- The structural kinds are `class`, `interface`, `provided-interface`, `required-interface`, `enumeration`, `datatype`, `object`, `component`, `component-port`, `artifact`, `node`, `device`, `execution`, `system`, `package` and `note`.
- The behavioural kinds are `actor`, `usecase`, `state`, `action`, `decision`, `merge`, `fork`, `join`, `activity-final`, `flow-final`, `object-node`, `send-signal`, `receive-signal` and `partition`.
- The interaction and state kinds are `lifeline`, `activation`, `destruction`, `fragment`, `interaction`, `gate`, `found`, `lost`, `choice`, `state-junction`, `history`, `entry`, `exit`, `terminate`, `region`, `initial` and `final`.

Sized rectangular nodes accept a bounded `width` and `height`. Class-like nodes also accept `stereotype`, `attributes` and `operations`. Their ports are `left`, `right`, `top` and `bottom`.

The relations are `association`, `dependency`, `generalization`, `realization`, `aggregation`, `composition`, `message`, `synchronous`, `asynchronous`, `return`, `control-flow`, `object-flow`, `assembly`, `delegation`, `transition`, `include` and `extend`.

```schemd bounds="1000x540" title="Documentation deploy interaction"
lifeline:CI7 "CI runner" at (220, 270) #cyan [width=170 height=400]
lifeline:PG7 "Pages host" at (620, 270) #amber [width=170 height=400]
artifact:ST7 "site/" at (880, 420) #emerald [width=170 height=80]

CI7.right90 -> PG7.left90 #cyan [line synchronous label="deploy(1.3.0)"]
PG7.left180 -> CI7.right180 #amber [line return dashed label="200 OK"]
CI7.right270 -> PG7.left270 #cyan [line asynchronous label="invalidate cache"]
ST7.left -> PG7.right350 #emerald [ortho dependency label="build output"]
```

A lifeline exposes `leftNN` and `rightNN`, which place a port exactly `NN` units below its top edge. That is how three messages sit at three exact heights without a layout engine deciding for us, and how the build output meets the host at 350 units.

<!-- /schemd-section -->

<!-- schemd-section: id=schema; eyebrow=06 / Data; title=Read the same facts as data -->

Every table on this page can also be read from the compiler. Since 1.3, `@schemd/core/schema` exports `SCHEMATIC_COMPONENT_SCHEMAS`, which gives each kind its family and its options. Each option carries a type, and the type says what the option accepts:

| Type                | What it states                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `enum`              | the accepted values and the default                                                      |
| `integer`, `number` | the range, the default, and any default that depends on the kind's `type`                |
| `text`              | the shortest and longest value                                                           |
| `pins`              | the most pins per side, the pattern a pin name must match, and the names it may not take |
| `rows`              | the most rows and the longest row                                                        |

A kind that needs one of several options lists them in `requiresOneOf`, as an IC does with its four sides. A pair that cannot appear together is listed in `conflicts`, as `fit` and `orientation` are.

Ports depend on options, so they are never listed by hand. `describeComponentPorts(kind, options)` asks the parser for the terminals a part has with those options, and a bad option throws the same `SchematicSyntaxError` a document would.

```ts
import { describeComponentPorts } from '@schemd/core/schema';

describeComponentPorts('switch', { type: 'spdt' });
// ['common', 'normally-open', 'normally-closed']
```

The schema is not a second source of truth that can drift. A test in the compiler probes the parser for every kind and option: each declared value must compile, each value just past a declared bound must fail, each undeclared option must fail, and each declared default must draw exactly what leaving the option out draws. The [component datasheets](/components) on this site are printed from the same data.

<!-- /schemd-section -->
