<!-- schemd-doc: id=math-labels; label=Math labels; title=Keep engineering labels crisp; summary=Use bounded micro-math scripts and Unicode without a browser text-measurement pass.; category=Author diagrams; order=30 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate label typography, not connectivity. -->

<!-- schemd-section: id=scripts; eyebrow=01 / Text; title=Compose scripts without baseline drift; example-title=Rotated components with upright math -->

There is no TeX runtime here, and the labels still read like engineering. Grouped `_` and `^` scripts nest, and bounded commands such as `\Omega`, `\pi`, `\theta`, `\mu`, and `\infty` resolve to glyphs. Each generated `tspan` carries an explicit baseline correction, so text following a nested script lands back on the parent baseline rather than drifting. Rotation stops at the vector: the label sits outside the rotated group and stays upright.

```schemd bounds="900x340" title="Rotated components with upright math"
source:V1 "V_{in}^{AC}" at (100, 150) #blue [type=voltage-ac]
resistor:R1 "10 k\Omega" right-of V1 by 150 #amber [orientation=down]
qgate:Q1 "R_z" right-of R1 by 160 #purple [parameter="\theta/2" phase="e^{i\phi}"]
port:O1 "f_c = \infty" right-of Q1 by 150 #emerald
```

Width is estimated, never measured — no font is loaded at any point. The estimator is deterministic and deliberately conservative, and a long label grows the component's bounds _before_ placement is validated. That ordering is what lets the whole thing work without an SSR-incompatible `getBBox()`.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=02 / Quantum; title=Use polished custom gate rows; example-title=Parameterized quantum register -->

`qgate` is the escape hatch, and it shares `hadamard`'s exact shell — same stub lengths, corner radius, focus treatment, and ports. Its `parameter`, `phase`, and `matrix` rows grow the body deterministically, so a custom operator can wear its own definition without becoming a different kind of object.

```schemd bounds="860x320" title="Parameterized quantum register"
prepare:P "|0\rangle" at (80, 130) #blue
hadamard:H "H" right-of P by 110 #cyan
qgate:U "U" right-of H by 130 #purple [parameter="\theta" matrix="[a,b;c,d]"]
measure:M "M_z" right-of U by 140 #emerald

P.out -> H.in #blue [quantum line]
H.out -> U.in #cyan [quantum line]
U.out -> M.in #purple [quantum line]
```

<!-- /schemd-section -->
