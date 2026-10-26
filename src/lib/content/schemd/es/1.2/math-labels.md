<!-- schemd-doc: id=math-labels; label=Etiquetas matemáticas; title=Mantenga nítidas las etiquetas de ingeniería; summary=Use subíndices y superíndices de sintaxis matemática limitada y Unicode sin medir el texto en el navegador.; category=Crear diagramas; order=30 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Estos ejemplos muestran la tipografía de las etiquetas, no conectividad. -->

<!-- schemd-section: id=scripts; eyebrow=01 / Texto; title=Componga subíndices y superíndices sin desplazar la línea base; example-title=Upright math on rotated parts -->

schemd no incluye un entorno de ejecución de TeX, pero sus etiquetas conservan la notación de ingeniería. Los subíndices `_` y superíndices `^` agrupados pueden anidarse. Un conjunto limitado de comandos, como `\Omega`, `\pi`, `\theta`, `\mu` y `\infty`, se convierte en glifos, al igual que `\langle`, `\rangle` y `\oplus`. Así, `|0\rangle` se lee como el ket que representa. Cada `tspan` generado incluye una corrección explícita de la línea base, por lo que el texto que sigue a un subíndice o superíndice anidado vuelve a la línea base de su nivel superior, sin desplazamientos acumulados. La rotación se limita al vector. La etiqueta queda fuera del grupo rotado y permanece horizontal.

```schemd bounds="900x340" title="Upright math on rotated parts"
source:V7 "V_{ref}^{+}" at (100, 150) #blue [type=voltage-dc]
inductor:L7 "4.7 \mu H" at (330, 150) #purple [orientation=down]
qgate:Q7 "R_y" at (570, 150) #purple [parameter="\pi/3" phase="e^{i\theta}"]
port:O7 "\langle Z \rangle" at (800, 150) #emerald
```

La anchura se mide a partir de una tabla, nunca del navegador, y no se carga ninguna fuente en ningún momento. El compilador incluye los anchos de avance de Arial, compartidos por Helvetica, Liberation Sans y Arimo, y establece esa lista como fuente predeterminada del SVG. En todo el vocabulario, la estimación se desvía como máximo un 1.5% de la anchura renderizada. El texto se comprime con `textLength` solo cuando desbordaría su espacio, y nunca se estira. Una etiqueta larga amplía los límites del componente antes de comprobar la colocación; por eso, todo el sistema funciona sin `getBBox()`, una llamada que no puede hacerse durante el renderizado en el servidor. Si el CSS de una página aplica al SVG una fuente más ancha, las etiquetas sobrepasarán el espacio calculado para ellas.

También se puede omitir por completo una etiqueta. En ese caso, el componente muestra su identificador y ninguna fila de etiqueta.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=02 / Cuántica; title=Use filas de detalle en puertas personalizadas; example-title=A custom operator with its definition -->

`qgate` permite crear puertas personalizadas y comparte exactamente la envolvente de `hadamard`: las mismas longitudes de patilla, el mismo radio de esquina, el mismo tratamiento del foco y los mismos puertos. Sus filas `parameter`, `phase` y `matrix` amplían el cuerpo en cantidades fijas. Así, un operador personalizado puede incluir su propia definición y conservar el mismo tipo de objeto.

```schemd bounds="860x320" title="A custom operator with its definition"
prepare:PG "|0\rangle" at (80, 130) #blue
ry:RG "R_y" at (270, 130) #cyan [parameter="\pi/8"]
qgate:UG "V" at (480, 130) #purple [parameter="\theta" matrix="[a,b;c,d]"]
measure:MG "M_x" at (700, 130) #emerald

PG.out -> RG.in #blue [quantum line]
RG.out -> UG.in #cyan [quantum line]
UG.out -> MG.in #purple [quantum line]
```

<!-- /schemd-section -->
