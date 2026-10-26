<!-- schemd-doc: id=placement; label=Colocación; title=Coloque componentes mediante relaciones; summary=Seis relaciones que se resuelven en coordenadas absolutas antes de ejecutar cualquier otra operación.; category=Crear diagramas; order=25 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->

<!-- schemd-section: id=why; eyebrow=01 / La idea; title=Indique dónde se sitúa un componente; example-title=Relative placement; example-summary=Solo BAT especifica coordenadas. -->

Las coordenadas funcionan bien con cuatro componentes. Con catorce resultan tediosas, y mover un componente obliga a recolocar todos los vecinos situados con respecto a él. Por eso, una declaración puede indicar una relación en lugar de una coordenada:

```text
kind:ID "label" at (x, y) #color [options]
kind:ID "label" right-of VIN by 150 #color [options]
```

Ambas formas son plenamente válidas y un documento puede combinarlas. La etiqueta es opcional en cualquiera de las dos. Un documento que nunca declara una relación se compila con exactamente los mismos bytes que antes.

```schemd bounds="900x560" title="Relative placement"
// Only BAT states coordinates.
source:BAT "9 V" at (90, 170) #blue [type=battery]
protection:FU "500 mA" right-of BAT by 150 #amber [type=fuse]
junction:VBUS right-of FU by 150 #cyan
capacitor:CBK "47 \mu F" below VBUS by 110 #cyan [type=polarized orientation=down]
port:LOAD "load" right-of VBUS by 150 #emerald
ground:GR "0 V" below FU by 190 aligned-x with FU #slate

BAT.positive -> FU.in #blue [ortho]
FU.out -> VBUS.node #amber [ortho]
VBUS.node -> CBK.in #cyan [ortho]
VBUS.node -> LOAD.in #emerald [ortho marker-end=arrow]
CBK.out -> GR.in #cyan [ortho]
BAT.negative -> GR.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=relations; eyebrow=02 / Vocabulario; title=Cuatro direcciones y dos alineaciones; example-title=Anchored to a part; example-summary=`aligned-y with EN` alinea el centro de la puerta con el puerto. -->

Hay seis relaciones. Cada una acepta un componente o uno de sus terminales. Las cuatro direcciones aceptan una distancia opcional con `by`, y las dos alineaciones aceptan un terminal opcional del componente que se coloca mediante `at`:

| Relación             | Establece                                                                         | `by` |
| -------------------- | --------------------------------------------------------------------------------- | ---- |
| `right-of REF`       | x: el borde izquierdo del componente deja libre el borde derecho de la referencia | sí   |
| `left-of REF`        | x: el borde derecho del componente deja libre el borde izquierdo de la referencia | sí   |
| `below REF`          | y: el borde superior del componente deja libre el borde inferior de la referencia | sí   |
| `above REF`          | y: el borde inferior del componente deja libre el borde superior de la referencia | sí   |
| `aligned-x with REF` | x, copiada de la referencia                                                       | no   |
| `aligned-y with REF` | y, copiada de la referencia                                                       | no   |

Cualquiera de las alineaciones puede terminar con `at PORT` para alinear uno de los terminales del propio componente en lugar de su origen. La [siguiente sección](#terminals) explica esta opción.

Aquí importan dos detalles. Una dirección se mide desde el cuerpo de la referencia y nunca desde su origen. Por tanto, `by 150` significa 150 unidades de espacio libre entre los bordes enfrentados, que es el espacio solicitado, y sigue siendo correcto cuando se gira la referencia. Sin `by`, el valor predeterminado es de 160 unidades en horizontal y 140 en vertical.

Un eje que no establece ninguna relación se hereda de la primera referencia. Así, `right-of A` coloca un componente junto a A y a su misma altura. Una alineación sustituye esa herencia y permite que un componente tome su columna de un componente y su fila de otro:

```schemd bounds="880x520" title="Anchored to a part"
port:EN "EN" at (140, 160) #blue
or:GO "OR" right-of EN by 200 aligned-y with EN #purple
port:OUTO "Q" right-of GO by 200 #emerald
port:RST "reset" below GO by 150 aligned-x with GO #amber [orientation=up]

EN.out -> GO.in1 #blue [ortho]
RST.out -> GO.in2 #amber [ortho]
GO.out -> OUTO.in #purple [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=terminals; eyebrow=03 / Terminales; title=Alinee un terminal; example-title=Terminal to terminal; example-summary=Cada puerta se coloca de modo que una de sus entradas quede a la altura del cable que la alimenta. -->

Una alineación copia una coordenada al origen del componente. Esto sirve para una resistencia, cuyos pines están en su línea central. No sirve para una puerta, cuyas entradas están por encima y por debajo del centro: `aligned-y with R.out` deja la entrada fuera de la línea del cable y este hace un quiebro para alcanzarla.

Desde 1.1, la alineación puede indicar uno de los terminales del propio componente mediante `at`:

```text
and:G2 "G" right-of R2 by 80 aligned-y with R2.out at in2 #blue [inputs=2]
```

El componente queda donde su `in2` esté a la altura de `R2.out`. Cualquiera de los dos lados puede ser un terminal. `REF.port` mide desde un terminal de la referencia y `at PORT` desde un terminal del componente. El terminal se normaliza a su nombre canónico, de modo que `at out` en una puerta se informa como `out1`. Un terminal que no existe en el componente se notifica con su línea: `R1 has no terminal named nowhere to line up with G1. Name one of R1's terminals, or remove at nowhere to align its centre.`

Alinear un terminal no basta para un componente que abarca varios cables, como un CNOT o un circuito integrado. [`fit=wires`](/docs/1.3/fit) existe para ese caso.

```schemd bounds="900x420" title="Terminal to terminal"
port:IC "c" at (100, 130) #blue
inductor:LC "10 \mu H" right-of IC by 100 #purple
and:GAN "AND" right-of LC by 100 aligned-y with LC.out at in2 #purple [inputs=2]
port:ID "d" at (100, 300) #blue
diode:DD "D" right-of ID by 100 #rose
or:GOR "OR" right-of DD by 100 aligned-y with DD.cathode at in1 #purple [inputs=2]

IC.out -> LC.in #blue [ortho]
LC.out -> GAN.in2 #purple [ortho]
ID.out -> DD.anode #blue [ortho]
DD.cathode -> GOR.in1 #rose [ortho]
```

La puerta AND se alinea por su segunda entrada y la OR por la primera, por lo que ambos cables llegan rectos.

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=04 / Funcionamiento; title=Las relaciones se resuelven antes de cualquier otra operación; example-title=Mixed forms; example-summary=Declaraciones absolutas y relativas resueltas conjuntamente. -->

La colocación no es un motor de distribución. Nunca decide dónde va un componente, porque cada coordenada se deriva de una relación escrita por el autor. Las relaciones se resuelven en un único `at (x, y)` antes de completar el AST. La lista de conexiones, las reglas de diseño, el mapa de origen y el renderizador no reciben información sobre la existencia de la colocación relativa. Las pruebas del compilador lo garantizan: un documento relativo y el documento absoluto al que se resuelve se compilan en SVG idénticos byte por byte.

La resolución consiste en una ordenación topológica y una pasada aritmética, sin solucionador ni iteraciones. Por tanto:

- Una referencia adelantada funciona. Un componente puede colocarse con respecto a otro declarado más abajo.
- Un ciclo es un error y el diagnóstico identifica sus miembros: `Placement cycle: A -> C -> B -> A.`
- El orden de evaluación no puede afectar al resultado, ya que una posición depende solo de las posiciones de sus referencias.

```schemd bounds="900x600" title="Mixed forms"
source:VGS "V_{gs}" at (110, 300) #purple [type=voltage-dc]
resistor:RGJ "1 M\Omega" right-of VGS by 130 #cyan
transistor:JF "J201" right-of RGJ by 130 #blue [type=njfet]
resistor:RDJ "2.2 k\Omega" above JF by 80 aligned-x with JF #cyan [orientation=down]
ground:JG "0 V" at (560, 510) #slate

VGS.positive -> RGJ.in #purple [ortho]
RGJ.out -> JF.gate #cyan [ortho]
RDJ.out -> JF.drain #cyan [ortho]
JF.source -> JG.in #slate [ortho]
VGS.negative -> JG.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=budget; eyebrow=05 / Cuando falla; title=Cada error indica su línea y su corrección; example-title=Reading the resolved coordinates; example-summary=`placements` informa del resultado de cada relación. -->

`limits.placementDepth` limita la longitud de una cadena y su valor predeterminado es 64. Cada diagnóstico incluye su línea:

| Declaración                                    | Diagnóstico                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Una referencia a algo no declarado             | `B is placed relative to R9, which the document never declares. Declare R9 anywhere in the document, or place B with at (x, y).` |
| Un componente colocado con respecto a sí mismo | `B is placed relative to itself. Reference another declaration, or place it with at (x, y).`                                     |
| Un ciclo                                       | `Placement cycle: A -> B -> C -> A. One component in a cycle must be placed with at (x, y).`                                     |
| `by -80`                                       | `B states a negative by distance of -80. Distances are unsigned; use the opposite direction instead.`                            |
| Un terminal que no existe                      | `A has no terminal named clock, so B cannot be placed against it. Reference A itself, or name a terminal it declares.`           |
| Un terminal `at` que el componente no tiene    | `B has no terminal named clock to line up with A. Name one of B's terminals, or remove at clock to align its centre.`            |
| Una cadena demasiado larga                     | `P5 sits 5 placements deep, past the 4 chain budget. Anchor one component in the chain with at (x, y).`                          |

[`diagnoseSchematic`](/docs/1.3/diagnostics) notifica todas las relaciones incorrectas a la vez, cada una en las columnas de la referencia que falla. Un ciclo se notifica una vez, en su primera línea bloqueada, y no se vuelve a atribuir un error a los componentes colocados con respecto a una declaración incorrecta. Esto incluye una declaración cuya propia línea falló, por ejemplo, por una opción desconocida: los componentes colocados con respecto a ella quedan sin colocar y no se notifican como referencias a algo no declarado. La aritmética de colocación trabaja con enteros en milésimas de unidad, por lo que una relación y su imagen especular quedan exactamente enfrentadas.

Una relación que desplaza un componente fuera del lienzo genera el mismo diagnóstico de límites que un `at (x, y)` incorrecto e indica una coordenada válida.

La compilación incluye los números resueltos:

```ts
const { placements } = compileSchematic(source, fence);
// [{ id: 'L1', line: 2, resolved: { x: 372, y: 200 },
//    relations: [{ kind: 'right-of', ref: 'FROM', gap: 160 }] }, …]
```

La lista está vacía en un documento que solo utiliza coordenadas y se ordena por línea de origen. Sus relaciones incluyen nombres canónicos de terminales, por lo que una relación informada siempre coincide con la lista de conexiones. El [inspector](/inspector/1.3.0) muestra la lista en su etapa Place.

```schemd bounds="960x400" title="Reading the resolved coordinates"
port:FROM "in" at (120, 200) #violet
inductor:L1 "L" right-of FROM by 160 #purple
resistor:R1 "R" right-of L1 by 160 #amber
port:TO "out" right-of R1 by 160 #emerald

FROM.out -> L1.in #violet [line]
L1.out -> R1.in #purple [line]
R1.out -> TO.in #amber [line]
```

<!-- /schemd-section -->
