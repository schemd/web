<!-- schemd-doc: id=math-labels; label=Math labels; title=Write compact math labels; summary=Use nested scripts and common symbols without shipping a TeX runtime.; category=Author diagrams; order=30 -->

<!-- schemd-section: id=scripts; eyebrow=01 / Scripts; title=Use subscripts and superscripts; example-title=Nested engineering labels; example-summary=Nested scripts return cleanly to the main baseline. -->

Use `_x` or `^2` for one shifted character. Use braces for a group: `V_{out}`, `f^{2n}`, or `A_{x_{sub}}`.

Scripts can nest. Each group has its own scale and baseline, and the next piece of text returns to the correct parent baseline.

```schemd bounds="920x320" title="Nested engineering labels"
port:VIN "V_{in} = 1 V" at (80, 160) #blue
resistor:R1 "R_{load} = 10 k\Omega" at (335, 160) #amber
capacitor:C1 "C_f e^{x^2}" at (590, 160) #cyan
port:VOUT "A_{x_{sub}} done" at (840, 160) #emerald

VIN.out -> R1.in #blue [line]
R1.out -> C1.in #amber [line]
C1.out -> VOUT.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=symbols-and-escapes; eyebrow=02 / Symbols; title=Use the built-in commands or raw Unicode; example-title=Quantum notation; example-summary=Symbols and qgate metadata share the same small parser. -->

Common commands include `\alpha`, `\beta`, `\Delta`, `\lambda`, `\mu`, `\Omega`, `\omega`, `\phi`, `\pi`, `\sigma`, `\theta`, `\cdot`, `\times`, `\pm`, `\le`, `\ge`, `\neq`, `\infty`, `\sqrt`, and `\rightarrow`. Raw Unicode works too.

Escape a literal backslash, brace, underscore, or caret with `\\`, `\{`, `\}`, `\_`, or `\^`. Unknown command names stay visible instead of becoming SVG markup. Labels are escaped before they reach the document.

Text width is estimated without loading a font. Wide Unicode receives a conservative allowance, but exact glyph metrics still depend on the font chosen by the browser.

```schemd bounds="880x340" title="Quantum notation"
port:QIN "|\psi_0〉 = |0〉" at (80, 170) #slate
hadamard:H1 "H: |0〉 \rightarrow |+〉" at (330, 170) #purple
qgate:RY1 "R_y(\theta)" at (600, 170) #cyan [parameter="\theta = \pi/2" phase="\phi = \pi/4"]
port:QOUT "|\psi_1〉" at (810, 170) #emerald

QIN.out -> H1.in #slate [line]
H1.out -> RY1.in #purple [line]
RY1.out -> QOUT.in #emerald [line marker-end=arrow]
```

<!-- /schemd-section -->
