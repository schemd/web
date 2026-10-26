<!-- schemd-doc: id=math-labels; label=Etiquetas matemáticas; title=Conserve la precisión de las etiquetas técnicas; summary=Use subíndices y superíndices acotados y Unicode sin medir el texto en el navegador.; category=Crear diagramas; order=30 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Estos ejemplos muestran la tipografía de las etiquetas. -->

<!-- schemd-section: id=scripts; eyebrow=01 / Texto; title=Componga subíndices y superíndices sin desplazar la línea base; example-title=Math that stays upright -->

Las etiquetas de schemd admiten notación técnica sin un entorno TeX. Los grupos de `_` y `^` pueden anidarse. Un conjunto acotado de órdenes, como `\Omega`, `\pi`, `\theta`, `\mu` e `\infty`, se convierte en glifos; también se admiten `\langle`, `\rangle` y `\oplus`. Por tanto, `|0\rangle` se representa como un ket. Cada `tspan` generado incluye una corrección explícita de la línea base. El texto posterior a un subíndice o superíndice anidado vuelve a la línea base de su nivel superior. El giro se aplica al vector y la etiqueta permanece derecha fuera de ese grupo.

```schemd bounds="900x340" title="Math that stays upright"
source:V8 "I_{q}^{-}" at (100, 150) #blue [type=current-dc]
resistor:R8 "2 M\Omega" at (330, 150) #amber [orientation=down]
qgate:Q8 "R_x" at (570, 150) #purple [parameter="\pi/6" phase="e^{-i\omega t}"]
port:O8 "\langle Y \rangle" at (800, 150) #emerald
```

La anchura se calcula mediante una tabla, sin consultar el navegador ni cargar una fuente. El compilador incluye los avances de Arial, compartidos por Helvetica, Liberation Sans y Arimo, y declara esa familia como predeterminada en el SVG. En el vocabulario completo, la estimación difiere menos del 1.5% de la anchura representada. `textLength` comprime el texto solo cuando rebasa su espacio; las etiquetas cortas conservan su anchura natural. Una etiqueta larga amplía los límites del componente antes de comprobar la posición. Así se evita `getBBox()`, una llamada que la representación en servidor no puede efectuar. Si el CSS de una página impone al SVG una fuente más ancha, las etiquetas pueden superar el espacio calculado.

También puede omitirse la etiqueta. El componente muestra entonces su designador y prescinde de la fila de etiqueta.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=02 / Cuántica; title=Use filas para definir puertas personalizadas; example-title=A custom gate that carries its matrix -->

`qgate` permite declarar una puerta personalizada y comparte la estructura de `hadamard`: longitudes de conexión, radio de las esquinas, tratamiento del foco y terminales. Las filas `parameter`, `phase` y `matrix` aumentan el cuerpo en cantidades fijas. Por ello, un operador personalizado puede incluir su definición dentro de la misma representación.

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
