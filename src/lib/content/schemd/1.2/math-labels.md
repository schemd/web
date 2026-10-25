<!-- schemd-doc: id=math-labels; label=Math labels; title=Keep engineering labels crisp; summary=Use bounded micro-math scripts and Unicode without a browser text-measurement pass.; category=Author diagrams; order=30 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate label typography, not connectivity. -->

<!-- schemd-section: id=scripts; eyebrow=01 / Text; title=Compose scripts without baseline drift; example-title=Upright math on rotated parts -->

schemd has no TeX runtime, and its labels still read like engineering notation. Grouped `_` and `^` scripts nest. A bounded set of commands, such as `\Omega`, `\pi`, `\theta`, `\mu` and `\infty`, resolves to glyphs, and so do `\langle`, `\rangle` and `\oplus`. Hence `|0\rangle` reads as the ket it is. Each generated `tspan` carries an explicit baseline correction, so text that follows a nested script returns to the parent baseline and never drifts. Rotation stops at the vector. The label sits outside the rotated group and stays upright.

```schemd bounds="900x340" title="Upright math on rotated parts"
source:V7 "V_{ref}^{+}" at (100, 150) #blue [type=voltage-dc]
inductor:L7 "4.7 \mu H" at (330, 150) #purple [orientation=down]
qgate:Q7 "R_y" at (570, 150) #purple [parameter="\pi/3" phase="e^{i\theta}"]
port:O7 "\langle Z \rangle" at (800, 150) #emerald
```

Width is measured from a table and never from a browser, and no font is loaded at any point. The compiler carries the advance widths of Arial, which Helvetica, Liberation Sans and Arimo share, and it names that stack as the SVG's default font. Across the vocabulary the estimate is within 1.5% of the rendered width. Text is compressed with `textLength` only when it would overflow its space, and it is never stretched. A long label grows the component's bounds before placement is checked, which is why the whole scheme works without `getBBox()`, a call that server rendering cannot make. A page whose CSS sets a wider face on the SVG will see labels overrun the space measured for them.

A label may also be left out altogether. The part then draws its designator and no label row.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=02 / Quantum; title=Use polished custom gate rows; example-title=A custom operator with its definition -->

`qgate` is the escape hatch, and it shares the exact shell of `hadamard`: the same stub lengths, corner radius, focus treatment and ports. Its `parameter`, `phase` and `matrix` rows grow the body by fixed amounts. A custom operator can therefore carry its own definition and remain the same kind of object.

```schemd bounds="860x320" title="A custom operator with its definition"
prepare:PG "|0\rangle" at (80, 130) #blue
ry:RG "R_y" at (270, 130) #cyan [parameter="\pi/8"]
qgate:UG "V" at (480, 130) #purple [parameter="\theta" matrix="[a,b;c,d]"]
measure:MG "M_x" at (700, 130) #emerald

PG.out -> RG.in #blue [quantum line]
RG.out -> UG.in #cyan [quantum line]
UG.out -> MG.in #purple [quantum line]
```

<!-- /schemd-section -->
