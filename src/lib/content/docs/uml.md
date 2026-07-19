# UML Nodes & Relations

UML support is not a bolt-on syntax — it is the same grammar you already know. A class is declared exactly like a resistor; a generalization is declared exactly like a wire. The payoff is that structural diagrams, behavioral diagrams, and electrical schematics can share a document, a color system, and a routing engine.

## The nine node kinds

`class`, `actor`, `usecase`, `state`, `lifeline`, `note`, `package`, `initial`, and `final` are first-class component keywords. Sizing is deterministic: box dimensions derive from the widest visible row (measured through the same micro-math metric the renderer uses), so a class never truncates its own attributes.

## Classes

`class` accepts four options: `attributes` and `operations` (semicolon-delimited rows), `stereotype` (1–128 characters, rendered as «guillemets» above the name), and `width` (a floor from 24 through 2048 — the computed width still wins when rows are wider). Compartments accept at most **64 rows** of at most **256 characters** each.

```schemd bounds="720x300" title="A small class hierarchy"
class:User "User" at (200, 150) #slate [attributes="- id: UUID; - email: String" operations="+ save(): void; + verify(): Bool"]
class:Admin "Admin" at (540, 90) #blue [attributes="- scope: Realm" stereotype="privileged"]
class:Guest "Guest" at (540, 220) #cyan

Admin.left -> User.right #blue [ortho generalization]
Guest.left -> User.right #cyan [ortho generalization]
```

## States, use cases, and the rest

`state` takes `details` rows (entry/do/exit behaviors) plus `width`. `usecase`, `lifeline`, `note`, and `package` take `width` and `height`. `actor`, `initial`, and `final` take no options at all — their glyphs are fixed.

```schemd bounds="720x260" title="A state transition fragment"
initial:S0 "start" at (90, 130) #slate
state:Idle "Idle" at (280, 130) #cyan [details="entry / arm timer"]
state:Run "Running" at (540, 130) #emerald [details="do / sample; exit / flush"]

S0.right -> Idle.left #slate [ortho transition label="boot"]
Idle.right -> Run.left #cyan [ortho transition label="trigger"]
```

## Ports on UML nodes

Every UML node exposes the six directional terminals `in`, `out`, `left`, `right`, `top`, and `bottom`. Lifelines add one more trick for sequence diagrams: `left<N>` and `right<N>` attach a message at N canvas units down the lifeline's stem (validated against the lifeline's height), so messages land exactly where time says they should.

## The ten relations

Connections accept a relation keyword — bare or as `relation=` — from: `association`, `dependency`, `generalization`, `realization`, `aggregation`, `composition`, `message`, `transition`, `include`, `extend`. Relations are semantics, and the renderer derives convention-correct visuals from them unless you override explicitly:

| Relation | Derived marker | Derived stroke |
| --- | --- | --- |
| `generalization`, `realization` | hollow `triangle` at the end | solid / dashed |
| `aggregation` | hollow `diamond` at the start | solid |
| `composition` | filled `diamond-filled` at the start | solid |
| `dependency`, `message`, `transition`, `include`, `extend` | `open-arrow` at the end | dashed for `dependency`, `include`, `extend` |
| `include`, `extend` | — | auto-labelled «include» / «extend» |

Explicit `marker-start=`, `marker-end=`, `dashed`, `solid`, or `label="…"` options always win over the derived defaults — the derivation only fills what you left unsaid.

```schemd bounds="720x260" title="Use-case include and extend"
actor:U "Customer" at (110, 130) #slate
usecase:UC1 "Checkout" at (380, 100) #blue
usecase:UC2 "Pay" at (620, 100) #emerald
usecase:UC3 "Apply coupon" at (620, 200) #amber

U.right -> UC1.left #slate [ortho association]
UC1.right -> UC2.left #blue [ortho include]
UC3.left -> UC1.right #amber [ortho extend]
```

<div class="admonition note">
<span class="title">Note: hollow markers on colored surfaces</span>
<p>Hollow triangles and diamonds knock out their interior with the surface color. Set <code>--schematic-surface</code> to your page background so they blend seamlessly — this site does exactly that in all three blueprint modes.</p>
</div>
