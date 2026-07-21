<!-- schemd-doc: id=math-labels; label=Math labels; title=Keep engineering labels crisp; summary=Use bounded micro-math scripts and Unicode without a browser text-measurement pass.; category=Author diagrams; order=30 -->

<!-- schemd-section: id=scripts; eyebrow=01 / Text; title=Compose scripts without baseline drift; example-title=Rotated components with upright math -->

Labels support grouped `_` and `^` scripts plus bounded commands such as `\Omega`, `\pi`, `\theta`, and `\infty`. Every generated `tspan` carries an explicit baseline correction; component rotation never rotates the outer label.

```schemd bounds="900x340" title="Rotated components with upright math"
source:V1 "V_{in}^{AC}" at (100, 150) #blue [type=voltage-ac]
resistor:R1 "10 k\Omega" at (330, 150) #amber [orientation=down]
qgate:Q1 "R_z" at (570, 150) #purple [parameter="\theta/2" phase="e^{i\phi}"]
port:O1 "f_c = \infty" at (800, 150) #emerald
```

The width estimator is deterministic and conservative. Long labels enlarge component bounds before placement validation rather than relying on SSR-incompatible `getBBox()`.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=02 / Quantum; title=Use polished custom gate rows; example-title=Parameterized quantum register -->

Plain `qgate` shares the same shell geometry, stub lengths, corner radius, focus treatment, and ports as `hadamard`. Detail rows increase the body deterministically.

```schemd bounds="860x320" title="Parameterized quantum register"
prepare:P "|0\rangle" at (80, 130) #blue
hadamard:H "H" at (260, 130) #cyan
qgate:U "U" at (470, 130) #purple [parameter="\theta" matrix="[a,b;c,d]"]
measure:M "M_z" at (690, 130) #emerald
P.out -> H.in #blue [quantum line]
H.out -> U.in #cyan [quantum line]
U.out -> M.in #purple [quantum line]
```

<!-- /schemd-section -->
