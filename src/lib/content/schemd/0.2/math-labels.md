<!-- schemd-doc: id=math-labels; label=Math labels; title=Write compact math labels; summary=Use nested scripts and common symbols without shipping a TeX runtime.; category=Author diagrams; order=30 -->

<!-- schemd-section: id=scripts; eyebrow=01 / Scripts; title=Use subscripts and superscripts; example-title=Nested engineering labels; example-summary=Nested scripts return cleanly to the main baseline. -->

There is no TeX runtime anywhere in schemd, and the labels still read like engineering. Use `_x` or `^2` to shift one character, braces when the script is a group: `V_{out}`, `f^{2n}`, or the deliberately awkward `A_{x_{sub}}`.

Scripts nest, and that is the trick worth understanding. Each group carries its own scale and baseline, so when a nested script ends the next run of text drops back onto the parent baseline exactly where the eye expects it — no drift, no manual kerning.

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

The common commands are all here — `\alpha`, `\beta`, `\Delta`, `\lambda`, `\mu`, `\Omega`, `\omega`, `\phi`, `\pi`, `\sigma`, `\theta`, `\cdot`, `\times`, `\pm`, `\le`, `\ge`, `\neq`, `\infty`, `\sqrt`, `\rightarrow` — and raw Unicode works just as well when we would rather paste the glyph.

For a literal character, escape it: `\\`, `\{`, `\}`, `\_`, `\^`. An unknown command is a non-event by design, staying visible as text rather than leaking into markup, and every label is escaped before it reaches the document — so a stray `<` can never become a tag.

One honest caveat: width is _estimated_, not measured, because no font is ever loaded. Wide Unicode gets a conservative allowance, but exact glyph metrics belong to whatever font the browser finally paints with.

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
