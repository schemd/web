<!-- schemd-doc: id=reading-back; label=Recuperar el documento; title=Recupere un diagrama compilado; summary=Un resumen textual de la geometría y la recuperación de declaraciones a partir del propio SVG.; category=Publicar resultados; order=75 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->

<!-- schemd-section: id=snapshot; eyebrow=01 / Resumen; title=Revise la geometría como texto, en lugar de como imagen; example-title=The digested diagram; example-summary=Cinco componentes y cuatro pistas en orden de aparición. -->

Las imágenes de referencia muestran si un dibujo se renderiza correctamente, y solo un navegador puede determinarlo. Resultan menos útiles para mostrar si algo se ha movido. Un vértice desplazado aparece como una mancha roja, y hay que abrir dos imágenes una junto a otra para ver qué cambió.

`snapshotSchematic` responde a la segunda cuestión mediante texto:

```ts
import { snapshotSchematic } from '@schemd/core/snapshot';

const digest = snapshotSchematic(document, fence);
```

Para la figura de al lado, el resumen comienza así:

```text
schemd-snapshot 1
bounds 900x560
component RLD resistor rect=(284.000,110.000,92.000,82.000) at=(330.000,150.000) color=token:amber
component DLD diode rect=(530.000,256.000,60.000,130.000) at=(560.000,320.000) orient=down color=alias:rose
trace VLD.positive->RLD.in curve=ortho markers=none/none color=token:blue net=$1 vertices=[(152.000,150.000),(288.000,150.000)]
```

Enumera cada rectángulo y cada vértice en orden de aparición, con los tres decimales que usa el generador de SVG. Si se guarda como archivo de referencia en el repositorio, convierte un cambio de trazado en una revisión de las pocas coordenadas que realmente se movieron.

Conviene conocer dos detalles. El `schemd-snapshot 1` inicial es una versión de formato. Un archivo de referencia guardado en el repositorio puede durar más que el código que lo escribió; sin esa línea, un cambio posterior de formato aparecería como una diferencia en todas las instantáneas a la vez. Una orientación también aparece solo cuando la declaración la especificó, porque un componente sin orientación es una declaración distinta de otro que indica su dirección canónica.

Un resumen no sustituye a un renderizador. No puede mostrar que falta una punta de flecha o que una etiqueta se solapa; el compilador conserva sus imágenes de referencia de Chromium precisamente para esos casos.

```schemd bounds="900x560" title="The digested diagram"
source:VLD "9 V" at (110, 150) #blue [type=voltage-dc]
resistor:RLD "390 \Omega" at (330, 150) #amber
junction:NLD at (560, 150) #cyan
diode:DLD "indicator" at (560, 320) #rose [type=led orientation=down]
ground:GLD "0 V" at (560, 460) #slate

VLD.positive -> RLD.in #blue [ortho]
RLD.out -> NLD.node #amber [ortho]
NLD.node -> DLD.anode #rose [ortho]
DLD.cathode -> GLD.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=recover; eyebrow=02 / Recuperación; title=La salida se puede volver a leer; example-title=What comes back; example-summary=Se conservan la colocación, el color, la curva y la topología, junto con fit=wires y la ausencia de etiqueta de un CNOT ajustado. -->

El modo `full` ya incorpora mucha información al marcado. Cada grupo de nodo incluye su ID, tipo, etiqueta, línea de código fuente y orientación; se sitúa mediante un `translate` y usa un token de color. Cada grupo de cable incluye sus extremos y su red, junto con el dominio de señal y la anchura de bus. Por tanto, la mayor parte de una declaración ya está en el marcado, pendiente de leer.

```ts
import { parseSchematicSvg } from '@schemd/core/decompile';

const { components, connections, source, lost } = parseSchematicSvg(svg);
```

Se trata de un explorador limitado a los atributos que escribe el renderizador, no de un analizador XML, porque las únicas entradas que deben funcionar son los diagramas producidos por este compilador. Rechaza la salida de `default` y `embedded-css`, ya que ese marcado no incluye los atributos necesarios.

Se conservan el ID, el tipo, la etiqueta, las coordenadas, la orientación y el color de cada componente. El `fit=wires` de un componente se lee de `data-fit`, y la posición recuperada es la ajustada, por lo que recompilarlo lo ajusta al mismo lugar. Un componente declarado sin etiqueta se recupera sin ella: el CNOT de la figura se recupera como `cnot:QX at (430, 220) #purple [fit=wires]`. Cada conexión conserva sus extremos, curva, color y marcadores, además de su anchura de bus y dominio de señal. Una conexión escrita con `trunk` incluye `data-wire-trunk` y se recupera como `trunk: true`. En ambos casos, cada red se dibuja como un árbol, por lo que el código fuente recuperado se vuelve a compilar en el mismo dibujo.

Un [subcircuito](/docs/1.2/subcircuits) no se conserva como bloque. El SVG solo contiene los componentes aplanados, de modo que el resultado contiene `U1_RT` y `U1_RB`, sin `divider:U1`, y no afirma lo contrario. La curva se lee del trazado dibujado. Solo `bezier` emite `C`; `ortho` avanza mediante pasos `H` y `V`.

```schemd bounds="880x440" title="What comes back"
prepare:QA0 "|1\rangle" at (120, 130) #blue
prepare:QA1 "|0\rangle" at (120, 310) #blue
cnot:QX at (430, 220) #purple [fit=wires]
port:QO0 "a" at (750, 130) #emerald
port:QO1 "b" at (750, 310) #emerald

QA0.out -> QX.in1 #blue [ortho]
QA1.out -> QX.in2 #blue [ortho]
QX.out1 -> QO0.in #purple [ortho]
QX.out2 -> QO1.in #purple [ortho marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=lost; eyebrow=03 / Alcance real; title=Se indica qué información no se recupera; example-title=A variant that does not survive; example-summary=Ambos aparecen como `data-node-kind="resistor"` en el marcado. -->

La recuperación es parcial e indica qué partes faltan. Las opciones de familia como `type=` y `variant=` no se escriben en ningún lugar que pueda leer el explorador; solo se conservan como prosa dentro del `aria-label` de cada grupo. Una resistencia recuperada es una resistencia ordinaria aunque se declarara como termistor.

```ts
recovery.lost;
// [{ code: 'component-variant', detail: 'Family options such as type= …' }, …]
```

No se incluye deliberadamente `fidelity: 'exact'` junto a esa lista. Todo documento con un componente pierde algo; una bandera que solo pudiera tener un valor no aportaría información. La lista indica qué se perdió.

La entrada mal formada sigue el mismo principio. Se omite cualquier grupo al que le falte un dato que el modo `full` siempre escribe. Inventar una etiqueta, una línea de código fuente o una curva para un marcado editado después de la compilación introduciría una declaración fabricada en el código fuente recuperado, lo cual es peor que reconocer que no se pudo leer el grupo.

El resultado describe fielmente la topología, la colocación y el color. No promete que recompilarlo reproduzca los bytes originales. Las propias pruebas del compilador fijan el alcance real de la afirmación: el código fuente recuperado se vuelve a compilar con la misma topología y colocación, y es un punto fijo de la recuperación.

```schemd bounds="820x360" title="A variant that does not survive"
resistor:RF1 "fixed" at (250, 180) #amber
resistor:RF2 "thermistor" right-of RF1 by 200 #amber [type=thermistor]

RF1.out -> RF2.in #amber [line]
```

<!-- /schemd-section -->
