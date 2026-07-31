<!-- schemd-doc: id=math-labels; label=Math labels; title=Keep engineering labels crisp; summary=Use bounded micro-math scripts and Unicode without a browser text-measurement pass.; category=Author diagrams; order=30 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate label typography, not connectivity. -->

<!-- schemd-section: id=scripts; eyebrow=01 / Text; title=Compose scripts without baseline drift; example-title=Rotated components with upright math -->

There is no TeX runtime here, and the labels still read like engineering. Grouped `_` and `^` scripts nest, and bounded commands such as `\Omega`, `\pi`, `\theta`, `\mu`, and `\infty` resolve to glyphs. Each generated `tspan` carries an explicit baseline correction, so text following a nested script lands back on the parent baseline rather than drifting. Rotation stops at the vector: the label sits outside the rotated group and stays upright.

```schemd bounds="900x340" title="Rotated components with upright math"
source:V2 "I_{bias}^{DC}" at (100, 150) #blue [type=current-dc]
capacitor:C2 "22 \mu F" at (330, 150) #amber [orientation=down]
qgate:Q2 "R_y" at (570, 150) #purple [parameter="\phi/4" phase="e^{-i\theta}"]
port:O2 "Z_{in} = \infty" at (800, 150) #emerald
```

Width is estimated, never measured — no font is loaded at any point. The estimator is deterministic and deliberately conservative, and a long label grows the component's bounds _before_ placement is validated. That ordering is what lets the whole thing work without an SSR-incompatible `getBBox()`.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=02 / Quantum; title=Use polished custom gate rows; example-title=Parameterized quantum register -->

`qgate` is the escape hatch, and it shares `hadamard`'s exact shell — same stub lengths, corner radius, focus treatment, and ports. Its `parameter`, `phase`, and `matrix` rows grow the body deterministically, so a custom operator can wear its own definition without becoming a different kind of object.

```schemd bounds="860x320" title="Parameterized quantum register"
prepare:PB "|+\rangle" at (80, 130) #blue
hadamard:HB "H" at (260, 130) #cyan
qgate:VB "V" at (470, 130) #purple [parameter="\lambda" matrix="[w,x;y,z]"]
measure:MB "M_x" at (690, 130) #emerald

PB.out -> HB.in #blue [quantum line]
HB.out -> VB.in #cyan [quantum line]
VB.out -> MB.in #purple [quantum line]
```

<!-- /schemd-section -->
