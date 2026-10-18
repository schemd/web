<!-- schemd-doc: id=math-labels; label=Math labels; title=Keep engineering labels crisp; summary=Use bounded micro-math scripts and Unicode without a browser text-measurement pass.; category=Author diagrams; order=30 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate label typography, not connectivity. -->

<!-- schemd-section: id=scripts; eyebrow=01 / Text; title=Compose scripts without baseline drift; example-title=Rotated components with upright math -->

There is no TeX runtime here, and the labels still read like engineering. Grouped `_` and `^` scripts nest, and bounded commands such as `\Omega`, `\pi`, `\theta`, `\mu`, and `\infty` resolve to glyphs — and since 1.0, so do `\langle`, `\rangle` and `\oplus`, so `|0\rangle` reads as the ket it is. Each generated `tspan` carries an explicit baseline correction, so text following a nested script lands back on the parent baseline rather than drifting. Rotation stops at the vector: the label sits outside the rotated group and stays upright.

```schemd bounds="900x340" title="Rotated components with upright math"
source:V5 "V_{ref}^{\pm}" at (100, 150) #blue [type=voltage-dc]
inductor:L5 "4.7 \mu H" at (330, 150) #cyan [orientation=down]
qgate:Q5 "R_y" at (570, 150) #purple [parameter="\pi/8" phase="e^{i\theta}"]
port:O5 "\langle Z \rangle" at (800, 150) #emerald
```

Width is measured from a table, never from a browser — no font is loaded at any point. 1.0 carries Arial's advance widths, which Helvetica, Liberation Sans and Arimo share, and names that stack as the SVG's default font, so the estimate is within 1.5% of the rendered width across the vocabulary. Text is compressed with `textLength` only when it would overflow its space and is never stretched. A long label still grows the component's bounds _before_ placement is validated, which is what lets the whole thing work without an SSR-incompatible `getBBox()`. A page whose CSS sets a wider face on the SVG will see labels overrun the space measured for them.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=02 / Quantum; title=Use polished custom gate rows; example-title=Parameterized quantum register -->

`qgate` is the escape hatch, and it shares `hadamard`'s exact shell — same stub lengths, corner radius, focus treatment, and ports. Its `parameter`, `phase`, and `matrix` rows grow the body deterministically, so a custom operator can wear its own definition without becoming a different kind of object.

```schemd bounds="860x320" title="Parameterized quantum register"
prepare:PE "|-\rangle" at (80, 130) #blue
ry:RE "R_y" at (270, 130) #cyan [parameter="2\theta"]
qgate:UE "V" at (480, 130) #purple [parameter="\gamma" matrix="[p,q;r,s]"]
measure:ME "M_x" at (700, 130) #emerald

PE.out -> RE.in #blue [quantum line]
RE.out -> UE.in #cyan [quantum line]
UE.out -> ME.in #purple [quantum line]
```

<!-- /schemd-section -->
