# Connections & Routing

A connection is a directed edge: `from.port -> to.port`, a color, and options. What makes it interesting is everything the compiler does on your behalf afterwards — port resolution, obstacle-aware routing, crossing bridges, and marker geometry. Let's go through it the way the parser does.

## The port tables

Endpoint validation happens after the whole document parses, against the component's actual kind. This table is the compiler's own allowlist, reproduced exactly:

| Kind | Valid ports |
| --- | --- |
| `resistor`, `capacitor`, `inductor` | `in`, `out`, `left`, `right`, `l`, `r` |
| `diode` | `anode`, `a`, `cathode`, `k`, `c` |
| `transistor` | `base`, `gate`, `b`, `g`, `collector`, `drain`, `c`, `d`, `emitter`, `source`, `e`, `s` |
| `port`, `hadamard`, `qgate` | `in`, `out` |
| `ground` | `in` only |
| `cnot` | `in`, `out`, `control`, `target` |
| logic gates | `in`, `out`, `in1`…`inN`, `out1`…`outN` (bounded by declared counts) |
| `ic` | every declared pin, plus the `in`/`out` aliases |
| UML nodes | `in`, `out`, `left`, `right`, `top`, `bottom` (+ `leftN`/`rightN` on lifelines) |

An invalid port produces a diagnostic that names all three parties: `Port U1.q7 is invalid for ic.`

## Routing strategies

Three geometries, chosen per connection:

- **`line`** (default) — a straight segment. Honest, fast, and correct for short hops.
- **`bezier`** — a cubic Bézier whose control points derive from the endpoints. Use it for flowing signal paths.
- **`ortho`** — the interesting one. Orthogonal routing treats every other component's body as an obstacle rectangle (with clearance) and searches for a Manhattan path around them. Where two orthogonal wires cross, the renderer draws a **bridge arc** over the lower wire — the classic draftsman's hop — so crossings never read as junctions.

```schemd bounds="680x280" title="Orthogonal routing around an obstacle"
port:A "Source" at (80, 140) #blue
ic:BLOCK "In the way" at (340, 140) [left="l1" right="r1"]
port:B "Sink" at (600, 60) #emerald
port:C "Sink 2" at (600, 220) #amber

A.out -> B.in #blue [ortho]
A.out -> C.in #amber [ortho]
```

The crossing pass is budgeted: at most **32,768** rendered intersections per document, after which compilation aborts rather than degrade.

## Markers

Seven marker primitives can terminate or originate a trace: `none`, `arrow`, `open-arrow`, `dot`, `triangle`, `diamond`, `diamond-filled`. Set them with `marker-start=` and `marker-end=`, or use the shorthands — a bare `arrow` or `dot` token applies to the destination end:

```schemd bounds="680x300" title="Marker vocabulary"
port:S1 "S1" at (90, 60) #slate
port:E1 "E1" at (590, 60) #slate
port:S2 "S2" at (90, 140) #slate
port:E2 "E2" at (590, 140) #slate
port:S3 "S3" at (90, 220) #slate
port:E3 "E3" at (590, 220) #slate

S1.out -> E1.in #blue [arrow]
S2.out -> E2.in #amber [marker-start=dot marker-end=open-arrow]
S3.out -> E3.in #purple [marker-start=diamond marker-end=triangle dashed]
```

## Labels and stroke style

`label="…"` centers text beside the routed connector (1 through 256 characters), with a paint-order halo in the surface color so it stays legible over grid lines. `dashed` and `solid` set the stroke pattern explicitly; otherwise UML relation semantics decide (dependency, realization, include, and extend dash by default).

Every option may be declared **at most once** per connection — a second routing keyword or a duplicated `label=` is a deterministic error with the connection's line number, not a silent override.

## Determinism, again

Connections render in source order, routes are computed during parse-time geometry validation and cached against the frozen document, and the renderer refuses documents it did not parse. If you compile the same source twice, you get byte-identical SVG — which is why share links in the playground are just the source itself.
