<!-- schemd-doc: id=math-labels; label=Math labels; title=Keep engineering labels crisp; summary=Use bounded micro-math scripts and Unicode without a browser text-measurement pass.; category=Author diagrams; order=30 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate label typography, not connectivity. -->

<!-- schemd-section: id=scripts; eyebrow=01 / Text; title=Compose scripts without baseline drift; example-title=Math that stays upright -->

schemd has no TeX runtime, and its labels still read like engineering notation. Grouped `_` and `^` scripts nest. A bounded set of commands, such as `\Omega`, `\pi`, `\theta`, `\mu` and `\infty`, resolves to glyphs, and so do `\langle`, `\rangle` and `\oplus`. Hence `|0\rangle` reads as the ket it is. Each generated `tspan` carries an explicit baseline correction, so text that follows a nested script returns to the parent baseline and never drifts. Rotation stops at the vector. The label sits outside the rotated group and stays upright.

```schemd bounds="900x340" title="Math that stays upright"
source:V8 "I_{q}^{-}" at (100, 150) #blue [type=current-dc]
resistor:R8 "2 M\Omega" at (330, 150) #amber [orientation=down]
qgate:Q8 "R_x" at (570, 150) #purple [parameter="\pi/6" phase="e^{-i\omega t}"]
port:O8 "\langle Y \rangle" at (800, 150) #emerald
```

Width is measured from a table and never from a browser, and no font is loaded at any point. The compiler carries the advance widths of Arial, which Helvetica, Liberation Sans and Arimo share, and it names that stack as the SVG's default font. Across the vocabulary the estimate is within 1.5% of the rendered width. Text is compressed with `textLength` only when it would overflow its space, and it is never stretched. A long label grows the component's bounds before placement is checked, which is why the whole scheme works without `getBBox()`, a call that server rendering cannot make. A page whose CSS sets a wider face on the SVG will see labels overrun the space measured for them.

A label may also be left out altogether. The part then draws its designator and no label row.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=02 / Quantum; title=Use polished custom gate rows; example-title=A custom gate that carries its matrix -->

`qgate` is the escape hatch, and it shares the exact shell of `hadamard`: the same stub lengths, corner radius, focus treatment and ports. Its `parameter`, `phase` and `matrix` rows grow the body by fixed amounts. A custom operator can therefore carry its own definition and remain the same kind of object.

```schemd bounds="860x320" title="A custom gate that carries its matrix"
prepare:PH "|1\rangle" at (80, 130) #blue
rz:RZ8 "R_z" at (270, 130) #cyan [parameter="\theta"]
qgate:UH "U_3" at (480, 130) #purple [parameter="\lambda, \phi" matrix="[p,q;r,s]"]
measure:MH "M_z" at (700, 130) #emerald

PH.out -> RZ8.in #blue [quantum line]
RZ8.out -> UH.in #cyan [quantum line]
UH.out -> MH.in #purple [quantum line]
```

<!-- /schemd-section -->
