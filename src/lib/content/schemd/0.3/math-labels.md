<!-- schemd-doc: id=math-labels; label=Math labels; title=Keep engineering labels crisp; summary=Use bounded micro-math scripts and Unicode without a browser text-measurement pass.; category=Author diagrams; order=30 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- These examples demonstrate label typography, not connectivity. -->

<!-- schemd-section: id=scripts; eyebrow=01 / Text; title=Compose scripts without baseline drift; example-title=Rotated components with upright math -->

Labels take grouped `_` and `^` scripts plus bounded commands such as `\Omega`, `\pi`, `\theta`, `\mu`, and `\infty`. Every generated `tspan` carries an explicit baseline correction, so a nested script returns the following text to the parent baseline exactly where the eye expects it.

Note that rotation stops at the vector. The label sits outside the rotated group, so a vertical component still reads horizontally:

```schemd bounds="920x360" title="Upright math on rotated bodies"
inductor:L1 "L = 47 \muH" at (120, 160) #purple [orientation=up]
capacitor:C1 "C_{out} = 220 \muF" at (390, 160) #cyan [orientation=down]
qgate:Q1 "U_\theta" at (650, 160) #amber [parameter="\theta \le \pi" phase="e^{-i\omega t}"]
port:O1 "\Delta I_L" at (860, 160) #emerald
```

Width is estimated, not measured — no font is ever loaded. The estimator is deterministic and deliberately conservative, and a long label enlarges the component's bounds _before_ placement is validated, which is what lets all of this work without an SSR-incompatible `getBBox()`.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=02 / Quantum; title=Use polished custom gate rows; example-title=Parameterized quantum register -->

A named rotation gate carries its angle in `parameter`, and `qgate` shares `hadamard`'s exact shell — same stub lengths, corner radius, focus treatment, and ports. Detail rows grow the body deterministically rather than by measurement.

```schemd bounds="880x330" title="Parameterized rotation chain"
prepare:P "|0\rangle" at (90, 150) #blue
ry:R "R_y" at (330, 150) #purple [parameter="\pi/3"]
zgate:Z "Z" at (540, 150) #cyan
measure:M "M" at (740, 150) #emerald

P.out -> R.in #blue [quantum line]
R.out -> Z.in #purple [quantum line]
Z.out -> M.in #cyan [quantum line]
```

<!-- /schemd-section -->
