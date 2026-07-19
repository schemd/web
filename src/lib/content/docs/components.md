# Component Primitives

The component registry is a single, collision-free keyword list — passives, analog devices, classical gates, quantum operators, custom ICs, and the UML family (which gets [its own chapter](./uml)). In this chapter we work through the electrical and computational primitives, with each one's options exactly as the parser validates them.

## Passives

`resistor`, `capacitor`, and `inductor` are the two-terminal workhorses. They accept **no options** — their geometry is fixed and their terminals are stable:

```schemd bounds="640x200" title="The three passives"
resistor:R1 "4.7 k\Omega" at (120, 100) #amber
capacitor:C1 "220 nF" at (320, 100) #cyan
inductor:L1 "10 mH" at (520, 100) #purple

R1.out -> C1.in #slate [ortho]
C1.out -> L1.in #slate [ortho]
```

## Diodes

`diode` selects its physical symbol variant through the `type` option: `standard` (the default), `schottky`, `zener`, or `led`. Terminals are `anode` (alias `a`) and `cathode` (aliases `k`, `c`) — the aliases exist because both conventions are common in practice.

```schemd bounds="640x300" title="Diode variants"
diode:D1 "1N4148" at (110, 90) #slate
diode:D2 "BAT54" at (330, 90) #blue [type=schottky]
diode:D3 "5V1" at (540, 90) #amber [type=zener]
diode:D4 "Status" at (330, 210) #emerald [type=led]
```

## Transistors

`transistor` covers bipolar and field-effect families via `type`: `npn` (default), `pnp`, `nmos`, `pmos`. The port set is generous with aliases so both BJT and FET vocabulary work: `base`/`gate` (`b`, `g`), `collector`/`drain` (`c`, `d`), and `emitter`/`source` (`e`, `s`).

## Ports and grounds

`port` is a system-boundary terminal with `in` and `out`. `ground` is the zero-volt reference; its `style` option selects `chassis`, `earth`, or `signal` (the default), and its only terminal is `in` — current flows into a ground, never out of it, and the port table enforces exactly that.

```schemd bounds="640x300" title="Ground styles"
port:VIN "V_{cc}" at (110, 80) #blue
ground:G1 "Signal" at (110, 190) #slate
ground:G2 "Chassis" at (320, 190) #slate [style=chassis]
ground:G3 "Earth" at (530, 190) #slate [style=earth]

VIN.out -> G1.in #slate [ortho]
```

## Classical logic gates

Six gate kinds — `and`, `or`, `not`, `nand`, `nor`, `xor` — with three options:

- **`inputs`** — an integer from **1 through 32**. Defaults to 2, except `not`, which defaults to 1.
- **`outputs`** — an integer from **1 through 32**, defaulting to 1.
- **`standard`** — `ieee` (default) for distinctive-shape symbols or `iec` for rectangular symbols.

Terminals follow a deterministic naming scheme: `in1` … `inN` and `out1` … `outN`, with `in` and `out` as stable aliases for the first of each. The gate contour grows to accommodate the pin count, and the geometry validator confirms the grown gate still fits your declared bounds.

```schemd bounds="640x260" title="Gate standards side by side"
port:A "A" at (70, 80) #blue
port:B "B" at (70, 160) #blue
xor:X1 "IEEE" at (300, 120) #cyan
xor:X2 "IEC" at (500, 120) #purple [standard=iec]

A.out -> X1.in1 #blue [ortho]
B.out -> X1.in2 #blue [ortho]
X1.out -> X2.in1 #cyan [ortho]
```

## Quantum operators

Three keywords cover the quantum family. Recall that all quantum gates are unitary; here the compiler's job is faithful notation, not simulation:

- **`hadamard`** — the H gate, terminals `in` and `out`.
- **`cnot`** — the controlled-NOT, with terminals `in`, `out`, `control`, and `target`. This is the gate that, together with H, prepares the Bell states in our simulation lab.
- **`qgate`** — the polymorphic operator. Its label is the operator symbol, and it accepts three optional attributes rendered through the micro-math pipeline: `parameter` (e.g. a rotation angle), `matrix` (a compact matrix description), and `phase`.

```schemd bounds="640x220" title="Bell-state preparation circuit"
port:Q0 "|0⟩" at (70, 80) #blue
port:Q1 "|0⟩" at (70, 160) #blue
hadamard:H1 "H" at (250, 80) #cyan
cnot:CX "CNOT" at (420, 120) #purple
port:M0 "q_0" at (580, 80) #emerald
port:M1 "q_1" at (580, 160) #emerald

Q0.out -> H1.in #blue
H1.out -> CX.control #cyan [ortho]
Q1.out -> CX.target #blue [ortho]
CX.out -> M0.in #purple [ortho]
```

## Custom integrated circuits

`ic` is the escape hatch for everything else: op-amps, timers, MCUs, or architecture blocks. You declare addressable pins per edge — `left`, `right`, `top`, `bottom` — as comma-separated lists, and the body sizes itself deterministically from the busiest opposing sides (minimum 88×64 canvas units).

The pin rules are strict, because connections address pins by name:

- Names match `[A-Za-z][A-Za-z0-9_-]{0,63}`; at most **64 pins per side**; at least one pin overall.
- Names must be unique across the whole chip, not merely per side.
- `in` and `out` are **reserved aliases**: `X.in` resolves to a pin literally named `in1` or else the first left/top pin, and `X.out` to `out1` or else the first right/bottom pin. Declaring a pin named `in` is rejected with a suggestion to use `in1`.

```schemd bounds="640x360" title="A 555 wired as an IC block"
ic:U1 "555" at (320, 150) [left="tr,th,dis" right="q,r" top="vcc" bottom="gnd"]
port:OUT "OUT" at (560, 120) #emerald
ground:G1 "0 V" at (320, 280) #slate

U1.q -> OUT.in #emerald [ortho]
U1.gnd -> G1.in #slate [ortho]
```

Notice the missing color on `U1` — `ic` is the one kind where the color token may be omitted, in which case it defaults to `slate`.

<div class="admonition note">
<span class="title">Note: budgets apply per document</span>
<p>A document accepts at most 512 components and 2,048 connections; the source itself is capped at 131,072 characters. These are hard parser limits, covered in <a href="./limits">Limits &amp; Security</a>.</p>
</div>
