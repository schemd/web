<!-- schemd-doc: id=placement; label=Colocación; title=Coloque los componentes mediante relaciones, sin hacer cálculos; summary=Seis relaciones que se resuelven como coordenadas absolutas antes de ejecutar cualquier otra operación.; category=Crear diagramas; order=25 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->

<!-- schemd-section: id=why; eyebrow=01 / Concepto; title=Indique dónde se sitúa un componente; example-title=Relative placement; example-summary=Solo VIN especifica coordenadas. -->

Las coordenadas resultan útiles para cuatro componentes. Con catorce se vuelven tediosas, y mover uno obliga a recolocar todos los vecinos situados con respecto a él. Por eso, una declaración puede indicar una relación en lugar de una coordenada:

```text
kind:ID "label" at (x, y) #color [options]
kind:ID "label" right-of VIN by 150 #color [options]
```

Ambas formas tienen el mismo rango, y un documento puede combinarlas. La etiqueta es opcional en las dos. Un documento que nunca escribe una relación se compila exactamente en los mismos bytes que antes.

```schemd bounds="900x560" title="Relative placement"
// Only VIN states coordinates.
source:VIN "5 V" at (90, 170) #blue [type=voltage-dc]
diode:DS "schottky" right-of VIN by 150 #rose [type=schottky]
junction:VSYS right-of DS by 150 #cyan
capacitor:CB "22 \mu F" below VSYS by 110 #cyan [type=polarized orientation=down]
port:SYS "system" right-of VSYS by 150 #emerald
ground:G0 "0 V" below DS by 190 aligned-x with DS #slate

VIN.positive -> DS.anode #blue [ortho]
DS.cathode -> VSYS.node #rose [ortho]
VSYS.node -> CB.in #cyan [ortho]
VSYS.node -> SYS.in #emerald [ortho marker-end=arrow]
CB.out -> G0.in #cyan [ortho]
VIN.negative -> G0.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=relations; eyebrow=02 / Vocabulario; title=Cuatro direcciones, dos alineaciones; example-title=Anchored to a part; example-summary=`aligned-y with AP` alinea el centro de la puerta con el puerto. -->

Hay seis relaciones. Cada una toma un componente o uno de sus terminales. Las cuatro direcciones admiten una distancia `by` opcional, y las dos alineaciones admiten un terminal `at` opcional del componente que se está colocando:

| Relación             | Coordenada que establece                                                               | `by` |
| -------------------- | -------------------------------------------------------------------------------------- | ---- |
| `right-of REF`       | x: el borde izquierdo del componente queda más allá del borde derecho de la referencia | sí   |
| `left-of REF`        | x: el borde derecho del componente queda más allá del borde izquierdo de la referencia | sí   |
| `below REF`          | y: el borde superior del componente queda más allá del borde inferior de la referencia | sí   |
| `above REF`          | y: el borde inferior del componente queda más allá del borde superior de la referencia | sí   |
| `aligned-x with REF` | x, copiada de la referencia                                                            | no   |
| `aligned-y with REF` | y, copiada de la referencia                                                            | no   |

Cualquiera de las alineaciones puede terminar con `at PORT` para alinear uno de los terminales del propio componente en lugar de su origen. La [siguiente sección](#terminals) lo explica.

Hay dos detalles relevantes. Una dirección mide desde el cuerpo de la referencia, nunca desde su origen. Por tanto, `by 150` significa 150 unidades de espacio libre entre los bordes enfrentados, que es el espacio solicitado, y sigue siendo correcto cuando se rota la referencia. Sin `by`, el valor predeterminado es de 160 unidades en horizontal y 140 en vertical.

Un eje que ninguna relación establezca se hereda de la primera referencia. Por eso, `right-of A` coloca un componente junto a A y a su misma altura. Una alineación reemplaza esa herencia; así puede tomar un componente su columna de otro y su fila de un tercero:

```schemd bounds="880x520" title="Anchored to a part"
port:AP "A" at (140, 160) #blue
xor:GX "XOR" right-of AP by 200 aligned-y with AP #purple
port:YP "Y" right-of GX by 200 #emerald
port:SEL "sel" below GX by 150 aligned-x with GX #amber [orientation=up]

AP.out -> GX.in1 #blue [ortho]
SEL.out -> GX.in2 #amber [ortho]
GX.out -> YP.in #purple [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=terminals; eyebrow=03 / Terminales; title=Alinee un terminal en lugar del centro; example-title=Terminal to terminal; example-summary=Cada puerta se coloca de modo que una de sus entradas quede a la altura del cable que la alimenta. -->

Una alineación copia una coordenada en el origen del componente. Eso sirve para una resistencia, cuyos pines se sitúan en su línea central. No sirve para una puerta, cuyas entradas están por encima y por debajo de su centro: `aligned-y with R.out` deja la entrada fuera de la línea del cable, y este se desvía para alcanzarla.

Por eso, desde la versión 1.1, la alineación puede nombrar uno de los terminales del propio componente mediante `at`:

```text
and:G2 "G" right-of R2 by 80 aligned-y with R2.out at in2 #blue [inputs=2]
```

El componente se sitúa donde su `in2` quede a la altura de `R2.out`. Cualquiera de los lados puede ser un terminal. `REF.port` mide desde un terminal de la referencia; `at PORT`, desde un terminal del componente. El terminal se convierte a su nombre canónico, por lo que `at out` en una puerta se informa como `out1`. Si el componente no tiene el terminal indicado, se informa con su línea: `R1 has no terminal named nowhere to line up with G1. Name one of R1's terminals, or remove at nowhere to align its centre.`

Alinear un terminal no basta para un componente que abarca varios cables, como un CNOT o un circuito integrado. Para ese caso existe [`fit=wires`](/docs/1.2/fit).

```schemd bounds="900x420" title="Terminal to terminal"
port:IA "a" at (100, 130) #blue
capacitor:CA "1 nF" right-of IA by 100 #cyan
nand:GA "NAND" right-of CA by 100 aligned-y with CA.out at in1 #purple [inputs=2]
port:IB "b" at (100, 300) #blue
resistor:RB "4.7 k\Omega" right-of IB by 100 #amber
nor:GB "NOR" right-of RB by 100 aligned-y with RB.out at in2 #purple [inputs=2]

IA.out -> CA.in #blue [ortho]
CA.out -> GA.in1 #cyan [ortho]
IB.out -> RB.in #blue [ortho]
RB.out -> GB.in2 #amber [ortho]
```

La NAND se alinea por su primera entrada y la NOR por la segunda, por lo que ambos cables llegan rectos.

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=04 / Funcionamiento; title=Las relaciones se resuelven antes de que las vea cualquier otra operación; example-title=Mixed forms; example-summary=Declaraciones absolutas y relativas resueltas conjuntamente. -->

La colocación no es un motor de disposición. Nunca decide dónde va un componente, porque cada coordenada se deriva de una relación escrita por el autor. Las relaciones se resuelven en un único `at (x, y)` antes de terminar el AST. La lista de conexiones, las reglas de diseño, el mapa de código fuente y el renderizador nunca ven la colocación relativa. Las pruebas del compilador lo fijan: un documento relativo y el documento absoluto al que se resuelve se compilan en SVG idénticos byte a byte.

La resolución consiste en una ordenación topológica y una pasada aritmética, sin solucionador ni iteraciones. En consecuencia:

- Una referencia adelantada es válida. Un componente puede colocarse con respecto a otro declarado más adelante.
- Un ciclo es un error, y el diagnóstico nombra sus miembros: `Placement cycle: A -> C -> B -> A.`
- El orden de evaluación no puede afectar al resultado, porque cada posición depende únicamente de las posiciones de sus referencias.

```schemd bounds="900x600" title="Mixed forms"
source:VBB "V_{bb}" at (110, 300) #purple [type=voltage-dc]
resistor:RB1 "47 k\Omega" right-of VBB by 130 #cyan
transistor:Q1 "2N3904" right-of RB1 by 130 #blue [type=npn]
resistor:RC1 "1 k\Omega" above Q1 by 80 aligned-x with Q1 #cyan [orientation=down]
ground:EG "0 V" at (560, 510) #slate

VBB.positive -> RB1.in #purple [ortho]
RB1.out -> Q1.base #cyan [ortho]
RC1.out -> Q1.collector #cyan [ortho]
Q1.emitter -> EG.in #slate [ortho]
VBB.negative -> EG.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=budget; eyebrow=05 / Errores; title=Cada error indica su línea y cómo corregirlo; example-title=Reading the resolved coordinates; example-summary=`placements` informa del resultado de cada relación. -->

`limits.placementDepth` limita la longitud de una cadena y su valor predeterminado es 64. Cada diagnóstico incluye su línea:

| Declaración                                 | Diagnóstico                                                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Referencia a un elemento no declarado       | `B is placed relative to R9, which the document never declares. Declare R9 anywhere in the document, or place B with at (x, y).` |
| Componente colocado con respecto a sí mismo | `B is placed relative to itself. Reference another declaration, or place it with at (x, y).`                                     |
| Ciclo                                       | `Placement cycle: A -> B -> C -> A. One component in a cycle must be placed with at (x, y).`                                     |
| `by -80`                                    | `B states a negative by distance of -80. Distances are unsigned; use the opposite direction instead.`                            |
| Terminal que no existe                      | `A has no terminal named clock, so B cannot be placed against it. Reference A itself, or name a terminal it declares.`           |
| Terminal `at` que el componente no tiene    | `B has no terminal named clock to line up with A. Name one of B's terminals, or remove at clock to align its centre.`            |
| Cadena demasiado larga                      | `P5 sits 5 placements deep, past the 4 chain budget. Anchor one component in the chain with at (x, y).`                          |

[`diagnoseSchematic`](/docs/1.2/diagnostics) informa de todas las relaciones defectuosas a la vez, cada una en las columnas de la referencia que falla. Un ciclo se informa una sola vez, en su primera línea bloqueada, y no se vuelve a culpar a los componentes colocados con respecto a una declaración defectuosa. Esto incluye las declaraciones cuya propia línea falló, por ejemplo, por una opción desconocida: los componentes situados con respecto a ellas quedan sin colocar y no se notifican como referencias a elementos no declarados. La aritmética de colocación trabaja con enteros en milésimas de unidad, por lo que una relación y su reflejo quedan exactamente en posiciones opuestas.

Una relación que sitúe un componente fuera del lienzo produce el mismo diagnóstico de límites que un `at (x, y)` incorrecto, e indica una coordenada válida.

La compilación incluye los valores resueltos:

```ts
const { placements } = compileSchematic(source, fence);
// [{ id: 'R1', line: 2, resolved: { x: 372, y: 200 },
//    relations: [{ kind: 'right-of', ref: 'SRC', gap: 160 }] }, …]
```

La lista está vacía en un documento que solo usa coordenadas y se ordena por línea de código fuente. Sus relaciones incluyen nombres de terminales canónicos, por lo que una relación informada siempre coincide con la lista de conexiones. El [inspector](/inspector/1.2.0) muestra la lista en su etapa Place.

```schemd bounds="960x400" title="Reading the resolved coordinates"
port:SRC "in" at (120, 200) #violet
resistor:R1 "R" right-of SRC by 160 #amber
capacitor:C1 "C" right-of R1 by 160 #cyan
port:DST "out" right-of C1 by 160 #emerald

SRC.out -> R1.in #violet [line]
R1.out -> C1.in #amber [line]
C1.out -> DST.in #cyan [line]
```

<!-- /schemd-section -->
