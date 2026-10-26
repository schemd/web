<!-- schemd-doc: id=fit; label=Ajustar a los cables; title=Deje que los cables determinen la altura de un componente; summary=fit=wires alinea las líneas de una puerta o los pines de un bloque con los terminales a los que están conectados para mantener rectos los cables.; category=Crear diagramas; order=23 -->

<!-- schemd-section: id=idea; eyebrow=01 / Concepto; title=Evite doblar los cables para alcanzar una separación fija; example-title=Parity onto an ancilla, fitted; example-summary=Dos CNOT cuyas líneas se sitúan sobre los cúbits que conectan. -->

Un bloque con varios terminales en un lado tiene una separación fija entre ellos. Las líneas de un CNOT están separadas 18 unidades, y un circuito integrado distribuye sus pines uniformemente a lo largo del cuerpo. Los cúbits y los buses rara vez están separados 18 unidades, por lo que antes cada cable debía doblarse para alcanzar el componente tanto al entrar como al salir.

`fit=wires` invierte ese proceso. En un componente declarado con esta opción, cada terminal toma la altura del terminal al que está conectado. El componente se centra entre ellos y el cuerpo del bloque crece para alojarlos. Así, los cables llegan rectos.

```schemd bounds="900x420" title="Parity onto an ancilla, fitted"
prepare:D0 "|0\rangle" at (80, 100) #blue
prepare:AN "|0\rangle" at (80, 220) #blue
prepare:D1 "|1\rangle" at (80, 340) #blue
cnot:PA at (380, 160) #purple [fit=wires]
cnot:PB at (580, 280) #purple [fit=wires]
port:O0 "d_0" at (800, 100) #emerald
measure:MP "parity" at (800, 220) #emerald
port:O1 "d_1" at (800, 340) #emerald

D0.out -> PA.in1 #blue [ortho]
AN.out -> PA.in2 #blue [ortho]
PA.out1 -> O0.in #purple [ortho]
D1.out -> PB.in1 #blue [ortho]
PA.out2 -> PB.in2 #purple [ortho]
PB.out1 -> O1.in #purple [ortho]
PB.out2 -> MP.in #purple [ortho]
```

Ambos CNOT escriben en el cúbit auxiliar `AN`, por lo que su medición da la paridad de `d_0` y `d_1`. Un documento que nunca usa `fit=wires` se compila exactamente en los mismos bytes que en la versión 1.0.

<!-- /schemd-section -->

<!-- schemd-section: id=what; eyebrow=02 / Elementos que se alinean; title=Líneas en las puertas, pines en los bloques; example-title=Three-bit oracle block; example-summary=Un circuito integrado cuyas cuatro entradas se sitúan sobre cuatro salidas Hadamard. -->

Dos familias admiten la opción:

| Componente                                                                  | Qué se ajusta a los cables                                                                                                   |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `cnot`, `cz`, `cphase`, `toffoli`, `controlled`, `swap`, `barrier`, `delay` | una línea por cúbit, a partir del cable de su entrada o, si no lo hay, del de su salida                                      |
| `ic` y bloques digitales (`mux`, `register`, `counter`, `flipflop` y otros) | los terminales izquierdos y derechos, cada lado en su orden declarado; los superiores e inferiores permanecen en su posición |

Las líneas de una puerta cuántica pueden aparecer en cualquier orden. Un CNOT cuyo control esté por debajo de su objetivo no necesita nada especial, y sus dos terminales verticales siguen apuntando en sentidos opuestos. Los pines de un bloque conservan el orden en que se declararon, de arriba abajo, y su cuerpo nunca se reduce por debajo de su altura habitual.

```schemd bounds="920x500" title="Three-bit oracle block"
prepare:X0 "|0\rangle" at (80, 100) #blue
prepare:X1 "|0\rangle" at (80, 200) #blue
prepare:X2 "|0\rangle" at (80, 300) #blue
prepare:YQ "|1\rangle" at (80, 400) #blue
hadamard:H0 at (230, 100) #cyan
hadamard:H1 at (230, 200) #cyan
hadamard:H2 at (230, 300) #cyan
hadamard:HY at (230, 400) #cyan
ic:OR "U_f" at (500, 250) #purple [left="a,b,c,y" right="ao,bo,co,yo" fit=wires]
measure:M0 at (800, 100) #emerald
measure:M1 at (800, 200) #emerald
measure:M2 at (800, 300) #emerald

X0.out -> H0.in #blue [ortho]
X1.out -> H1.in #blue [ortho]
X2.out -> H2.in #blue [ortho]
YQ.out -> HY.in #blue [ortho]
H0.out -> OR.a #cyan [ortho]
H1.out -> OR.b #cyan [ortho]
H2.out -> OR.c #cyan [ortho]
HY.out -> OR.y #cyan [ortho]
OR.ao -> M0.in #purple [ortho]
OR.bo -> M1.in #purple [ortho]
OR.co -> M2.in #purple [ortho]
```

El pin `yo`, que no está conectado, mantiene respecto a su vecino conectado la separación habitual del bloque. Un componente sin conexiones en los terminales que se ajustan conserva su forma habitual; por eso, se puede escribir `fit=wires` antes de que existan sus cables. Las puertas Hadamard y las mediciones de este ejemplo no llevan etiquetas porque cada símbolo ya indica qué es.

<!-- /schemd-section -->

<!-- schemd-section: id=rules; eyebrow=03 / Determinismo; title=El ajuste se resuelve de izquierda a derecha, nunca por el orden del código fuente; example-title=Control below its target; example-summary=La línea de control se sitúa por debajo del objetivo sin sintaxis adicional. -->

El ajuste se calcula mediante operaciones aritméticas, sin búsquedas. Sus reglas son breves:

- Los componentes se ajustan de izquierda a derecha, después de arriba abajo y, por último, por ID. Cada uno solo lee los componentes ya ajustados, por lo que una cadena de puertas se ajusta desde la primera en adelante. En la figura de paridad, `PB` lee la línea que `PA` ya ha ajustado.
- Un terminal conectado a varios componentes sigue al más cercano; en caso de empate, al más alto y después al primero por nombre.
- El centro del componente se calcula. Se sitúa a mitad de camino entre sus terminales conectados más externos, de modo que la `y` de la declaración solo importa mientras no haya conexiones.
- La colocación se realiza primero. Un componente colocado con relación a otro que se ajusta se mide a partir de su forma sin ajustar. Por tanto, sus vecinos necesitan dejarle espacio para crecer, o pueden colocarse con `at (x, y)`.

Cambiar el orden de las líneas de un documento nunca cambia su dibujo.

```schemd bounds="820x380" title="Control below its target"
prepare:TG "|+\rangle" at (90, 120) #blue
prepare:CT "|1\rangle" at (90, 280) #blue
cnot:CR at (400, 200) #purple [fit=wires]
port:TO "target" at (720, 120) #emerald
port:CO "control" at (720, 280) #emerald

CT.out -> CR.in1 #blue [ortho]
TG.out -> CR.in2 #blue [ortho]
CR.out1 -> CO.in #purple [ortho]
CR.out2 -> TO.in #purple [ortho]
```

El componente compilado registra dónde quedaron sus terminales como desplazamientos respecto a su centro: `rails` en una puerta ajustada y `rows` en un bloque ajustado. El marcado del modo `full` incluye `data-fit="wires"`, y [`parseSchematicSvg`](/docs/1.2/reading-back) lo recupera como `[fit=wires]`.

<!-- /schemd-section -->

<!-- schemd-section: id=limits; eyebrow=04 / Cuando no es posible; title=Un ajuste imposible indica qué podría funcionar; example-title=Lined up by its first input; example-summary=Una puerta colocada de modo que su propio in1 quede a la altura del condensador. -->

Dos terminales deben llegar con al menos 16 unidades de separación, y los terminales de un bloque deben llegar en el orden en que se declaran sus pines. Cuando no se cumplen estas condiciones, el diagnóstico nombra el terminal e indica una altura válida:

| Declaración                                           | Diagnóstico                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dos pines alimentados con 10 unidades de separación   | `U1 cannot line up q with its wire: it arrives 10 units below p's, and pins need at least 16. Move the wire on q to y >= 216, or remove fit=wires.`                            |
| Pines alimentados en un orden incorrecto              | `U1 cannot line up i1 with its wire: it arrives at y=100, above i0's at y=200, but i1 sits below i0 on U1's left side. Swap the wires, reorder the pins, or remove fit=wires.` |
| `fit=wires` con `orientation`                         | `fit=wires lines terminals up with their wires vertically; remove orientation or fit.`                                                                                         |
| `fit=wires` en un componente con un terminal por lado | `Option fit is not supported for measure; it lines up the rails of a gate that spans several qubits.`                                                                          |

El ajuste está pensado para componentes que abarcan varios cables. Un componente con un terminal a cada lado se alinea mediante ese terminal. Una alineación escrita con `at PORT` coloca el componente de modo que su propio terminal quede a la altura de la referencia; una alineación simple usaría el centro del componente. La página de [colocación](/docs/1.2/placement#terminals) lo explica en detalle.

```schemd bounds="780x340" title="Lined up by its first input"
port:IN "IN" at (90, 190) #blue
capacitor:CC "100 nF" right-of IN by 110 #cyan
nand:GN "NAND" right-of CC by 110 aligned-y with CC.out at in1 #purple [inputs=2]
port:OUTN "Q" right-of GN by 110 #emerald

IN.out -> CC.in #blue [ortho]
CC.out -> GN.in1 #cyan [ortho]
GN.out1 -> OUTN.in #purple [ortho]
```

<!-- /schemd-section -->
