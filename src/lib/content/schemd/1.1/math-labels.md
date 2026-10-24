<!-- schemd-doc: id=math-labels; label=Math labels; title=Keep engineering labels crisp; summary=Use bounded micro-math scripts and Unicode without a browser text-measurement pass.; category=Author diagrams; order=30 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate label typography, not connectivity. -->

<!-- schemd-section: id=scripts; eyebrow=01 / Text; title=Compose scripts without baseline drift; example-title=Rotated parts with upright math -->

There is no TeX runtime here, and the labels still read like engineering. Grouped `_` and `^` scripts nest, and bounded commands such as `\Omega`, `\pi`, `\theta`, `\mu`, and `\infty` resolve to glyphs — and since 1.0, so do `\langle`, `\rangle` and `\oplus`, so `|0\rangle` reads as the ket it is. Each generated `tspan` carries an explicit baseline correction, so text following a nested script lands back on the parent baseline rather than drifting. Rotation stops at the vector: the label sits outside the rotated group and stays upright.

```schemd bounds="900x340" title="Rotated parts with upright math"
source:V6 "I_{bias}^{+}" at (100, 150) #blue [type=current-dc]
capacitor:C6 "22 \mu F" at (330, 150) #cyan [orientation=down]
qgate:Q6 "R_z" at (570, 150) #purple [parameter="\theta/2" phase="e^{-i\phi}"]
port:O6 "\langle X \rangle" at (800, 150) #emerald
```

Width is measured from a table, never from a browser — no font is loaded at any point. The compiler carries Arial's advance widths, which Helvetica, Liberation Sans and Arimo share, and names that stack as the SVG's default font, so the estimate is within 1.5% of the rendered width across the vocabulary. Text is compressed with `textLength` only when it would overflow its space and is never stretched. A long label still grows the component's bounds _before_ placement is validated, which is what lets the whole thing work without an SSR-incompatible `getBBox()`. A page whose CSS sets a wider face on the SVG will see labels overrun the space measured for them.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=02 / Quantum; title=Use polished custom gate rows; example-title=Parameterized rotation register -->

`qgate` is the escape hatch, and it shares `hadamard`'s exact shell — same stub lengths, corner radius, focus treatment, and ports. Its `parameter`, `phase`, and `matrix` rows grow the body deterministically, so a custom operator can wear its own definition without becoming a different kind of object.

```schemd bounds="860x320" title="Parameterized rotation register"
prepare:PF "|+\rangle" at (80, 130) #blue
rx:RF "R_x" at (270, 130) #cyan [parameter="\pi/4"]
qgate:UF "W" at (480, 130) #purple [parameter="\lambda" matrix="[u,v;w,z]"]
measure:MF "M_z" at (700, 130) #emerald

PF.out -> RF.in #blue [quantum line]
RF.out -> UF.in #cyan [quantum line]
UF.out -> MF.in #purple [quantum line]
```

<!-- /schemd-section -->
