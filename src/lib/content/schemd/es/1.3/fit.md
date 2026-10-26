<!-- schemd-doc: id=fit; label=Ajuste a los cables; title=Deje que los cables determinen la altura del componente; summary=fit=wires alinea las líneas de una puerta o los pines de un bloque con los terminales conectados a ellos, para que los cables rectos sigan rectos.; category=Crear diagramas; order=23 -->

<!-- schemd-section: id=idea; eyebrow=01 / La idea; title=Evite doblar cables para adaptarlos a un paso fijo; example-title=Repetition encoder, fitted; example-summary=Dos CNOT cuyas líneas se sitúan sobre los cúbits que conectan. -->

Un bloque con varios terminales en un lado tiene un paso fijo. Las líneas de un CNOT están separadas por 18 unidades y un circuito integrado distribuye sus pines uniformemente a lo largo del cuerpo. Los cúbits y los buses rara vez están separados por 18 unidades, por lo que antes cada cable se doblaba para alcanzar el componente al entrar y de nuevo al salir.

`fit=wires` invierte ese comportamiento. En un componente declarado con esta opción, cada terminal toma la altura del terminal al que está conectado. El componente se centra entre ellos y el cuerpo de un bloque crece para alojarlos. Así, los cables llegan rectos.

```schemd bounds="900x420" title="Repetition encoder, fitted"
prepare:A1 "|0\rangle" at (80, 100) #blue
prepare:DQ "|\phi\rangle" at (80, 220) #blue
prepare:A2 "|0\rangle" at (80, 340) #blue
cnot:EA at (380, 160) #purple [fit=wires]
cnot:EB at (580, 280) #purple [fit=wires]
port:Q1 "q_1" at (800, 100) #emerald
port:Q0 "q_0" at (800, 220) #emerald
port:Q2 "q_2" at (800, 340) #emerald

DQ.out -> EA.in1 #blue [ortho]
A1.out -> EA.in2 #blue [ortho]
EA.out2 -> Q1.in #purple [ortho]
EA.out1 -> EB.in1 #purple [ortho]
A2.out -> EB.in2 #blue [ortho]
EB.out1 -> Q0.in #purple [ortho]
EB.out2 -> Q2.in #purple [ortho]
```

Ambos CNOT copian el cúbit de datos `DQ` en un cúbit auxiliar, lo que distribuye un bit lógico entre tres cúbits. Un documento que nunca declara `fit=wires` se compila con exactamente los mismos bytes que en 1.0.

<!-- /schemd-section -->

<!-- schemd-section: id=what; eyebrow=02 / Elementos que se alinean; title=Líneas en las puertas y pines en los bloques; example-title=Two-bit oracle block; example-summary=Un circuito integrado cuyas tres entradas se sitúan sobre tres salidas de Hadamard. -->

Dos familias aceptan la opción:

| Componente                                                                  | Elementos que siguen sus cables                                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `cnot`, `cz`, `cphase`, `toffoli`, `controlled`, `swap`, `barrier`, `delay` | una línea por cúbit, a partir del cable de su entrada o del de su salida cuando la entrada no tiene ninguno               |
| `ic` y bloques digitales (`mux`, `register`, `counter`, `flipflop` y otros) | los terminales izquierdos y derechos, cada lado en su orden declarado; los superiores e inferiores permanecen en su lugar |

Las líneas de una puerta cuántica pueden presentarse en cualquier orden. Un CNOT cuyo control se sitúa debajo del objetivo no necesita nada especial y sus dos terminales verticales siguen orientados en sentidos opuestos. Los pines de un bloque conservan el orden en que se declararon, de arriba abajo, y su cuerpo nunca se reduce por debajo de su altura habitual.

```schemd bounds="920x450" title="Two-bit oracle block"
prepare:XA "|0\rangle" at (80, 110) #blue
prepare:XB "|0\rangle" at (80, 230) #blue
prepare:TG "|1\rangle" at (80, 350) #blue
hadamard:HA at (230, 110) #cyan
hadamard:HB at (230, 230) #cyan
hadamard:HT at (230, 350) #cyan
ic:UG "U_g" at (500, 230) #purple [left="a,b,t" right="ao,bo,to" fit=wires]
measure:MA at (800, 110) #emerald
measure:MB at (800, 230) #emerald

XA.out -> HA.in #blue [ortho]
XB.out -> HB.in #blue [ortho]
TG.out -> HT.in #blue [ortho]
HA.out -> UG.a #cyan [ortho]
HB.out -> UG.b #cyan [ortho]
HT.out -> UG.t #cyan [ortho]
UG.ao -> MA.in #purple [ortho]
UG.bo -> MB.in #purple [ortho]
```

El pin `to`, sin conectar, se separa de su vecino conectado según el paso habitual del bloque. Un componente sin conexiones en los terminales que se ajustan conserva su forma habitual, por lo que `fit=wires` puede escribirse antes de que existan sus cables. Las puertas de Hadamard y las mediciones de este ejemplo no llevan etiquetas, ya que cada símbolo indica lo que es.

<!-- /schemd-section -->

<!-- schemd-section: id=rules; eyebrow=03 / Determinismo; title=Se resuelve de izquierda a derecha, independientemente del orden del código; example-title=Control under the target; example-summary=La línea de control queda debajo del objetivo, sin sintaxis adicional. -->

El ajuste es aritmético y no realiza búsquedas. Sus reglas son breves:

- Los componentes ajustados se resuelven de izquierda a derecha, después de arriba abajo y finalmente por ID. Cada uno lee solo los componentes ya resueltos, por lo que una cadena de puertas se ajusta desde la primera en adelante. En la figura del codificador, `EB` lee la línea que `EA` ya ha ajustado.
- Un terminal conectado a varios componentes sigue al más cercano, después al más alto y finalmente al primero por nombre.
- El centro del componente se calcula. Se sitúa a mitad de camino entre sus terminales conectados más externos, por lo que la `y` escrita en la declaración solo importa mientras no haya conexiones.
- La colocación se ejecuta primero. Un componente colocado con relación a otro ajustado se mide a partir de su forma sin ajustar. Por tanto, sus vecinos necesitan espacio para que crezca, o pueden colocarse con `at (x, y)`.

Reordenar las líneas de un documento nunca cambia su dibujo.

```schemd bounds="840x400" title="Control under the target"
prepare:TQ "|0\rangle" at (90, 110) #blue
prepare:CQ "|1\rangle" at (90, 300) #blue
cnot:CB at (420, 205) #purple [fit=wires]
port:TOUT "target" at (740, 110) #emerald
port:COUT "control" at (740, 300) #emerald

CQ.out -> CB.in1 #blue [ortho]
TQ.out -> CB.in2 #blue [ortho]
CB.out1 -> COUT.in #purple [ortho]
CB.out2 -> TOUT.in #purple [ortho]
```

El componente compilado registra las posiciones de sus terminales como desplazamientos desde su centro: `rails` en una puerta ajustada y `rows` en un bloque ajustado. El marcado en modo `full` incluye `data-fit="wires"`, y [`parseSchematicSvg`](/docs/1.3/reading-back) lo recupera como `[fit=wires]`.

<!-- /schemd-section -->

<!-- schemd-section: id=limits; eyebrow=04 / Cuando no es posible; title=Un ajuste imposible indica qué funcionaría; example-title=Lined up by its second input; example-summary=Una puerta colocada de modo que su propio in2 quede a la altura del diodo. -->

Dos terminales deben llegar separados al menos 16 unidades y los terminales de un bloque deben llegar en el orden en que se declaran sus pines. Si no ocurre así, el diagnóstico identifica el terminal e indica una altura que funcionaría:

| Declaración                                             | Diagnóstico                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dos pines alimentados con una separación de 10 unidades | `U1 cannot line up q with its wire: it arrives 10 units below p's, and pins need at least 16. Move the wire on q to y >= 216, or remove fit=wires.`                            |
| Pines alimentados en el orden incorrecto                | `U1 cannot line up i1 with its wire: it arrives at y=100, above i0's at y=200, but i1 sits below i0 on U1's left side. Swap the wires, reorder the pins, or remove fit=wires.` |
| `fit=wires` con `orientation`                           | `fit=wires lines terminals up with their wires vertically; remove orientation or fit.`                                                                                         |
| `fit=wires` en un componente con un terminal por lado   | `Option fit is not supported for measure; it lines up the rails of a gate that spans several qubits.`                                                                          |

El ajuste está destinado a componentes que abarcan varios cables. Un componente con un terminal en cada lado se alinea mediante ese terminal. Una alineación escrita con `at PORT` coloca el componente de modo que su propio terminal quede a la altura de la referencia, mientras que una alineación simple usaría el centro del componente. La página de [colocación](/docs/1.3/placement#terminals) lo explica por completo.

```schemd bounds="800x360" title="Lined up by its second input"
port:SRC "IN" at (90, 200) #blue
diode:DF "clamp" right-of SRC by 110 #rose
xor:GQ "XOR" right-of DF by 110 aligned-y with DF.cathode at in2 #purple [inputs=2]
port:QX "Y" right-of GQ by 110 #emerald

SRC.out -> DF.anode #blue [ortho]
DF.cathode -> GQ.in2 #rose [ortho]
GQ.out1 -> QX.in #purple [ortho]
```

<!-- /schemd-section -->
