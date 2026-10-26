<!-- schemd-doc: id=reading-back; label=Recuperación del diagrama; title=Recupere un diagrama compilado; summary=Un resumen textual de la geometría y la recuperación de declaraciones a partir del propio SVG.; category=Publicar resultados; order=75 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->

<!-- schemd-section: id=snapshot; eyebrow=01 / Resumen; title=Revise la geometría como texto; example-title=The digested diagram; example-summary=Cinco componentes y cuatro pistas, en el orden del código fuente. -->

Las imágenes de referencia muestran si un dibujo se renderiza correctamente y solo un navegador puede comprobarlo. Resultan menos útiles para mostrar si algo se ha movido. Un vértice desplazado aparece como una mancha roja y es necesario abrir dos imágenes una junto a otra para ver qué cambió.

`snapshotSchematic` responde a la segunda pregunta mediante texto:

```ts
import { snapshotSchematic } from '@schemd/core/snapshot';

const digest = snapshotSchematic(document, fence);
```

Para la figura que acompaña a este texto, el resumen empieza así:

```text
schemd-snapshot 1
bounds 900x560
component RB resistor rect=(284.000,110.000,92.000,82.000) at=(330.000,150.000) color=token:amber
component CB capacitor rect=(535.540,256.000,48.920,130.000) at=(560.000,320.000) orient=down color=token:purple
trace VB.positive->RB.in curve=ortho markers=none/none color=token:blue net=$1 vertices=[(152.000,150.000),(288.000,150.000)]
```

Enumera todos los rectángulos y vértices en el orden del código fuente, con los tres decimales que utiliza el generador de SVG. Guardado como archivo de referencia en el repositorio, convierte un cambio de trazado en una revisión de las pocas coordenadas que realmente se movieron.

Conviene conocer dos detalles. El encabezado `schemd-snapshot 1` es una versión del formato. Un archivo de referencia guardado perdura más que el código que lo escribió y, sin esa línea, un cambio posterior de formato aparecería como una diferencia simultánea en todas las instantáneas. Además, una orientación solo aparece si la declaración la especificó, ya que un componente sin orientación es una declaración distinta de otro que indica su dirección canónica.

Un resumen no sustituye a un renderizador. No puede mostrar que ha desaparecido una punta de flecha o que una etiqueta se ha solapado, por lo que el compilador conserva sus imágenes de referencia de Chromium para esos casos.

```schemd bounds="900x560" title="The digested diagram"
source:VB "5 V" at (110, 150) #blue [type=voltage-dc]
resistor:RB "4.7 k\Omega" at (330, 150) #amber
junction:NB at (560, 150) #cyan
capacitor:CB "100 \mu F" at (560, 320) #purple [type=polarized orientation=down]
ground:GB "0 V" at (560, 470) #slate

VB.positive -> RB.in #blue [ortho]
RB.out -> NB.node #amber [ortho]
NB.node -> CB.in #purple [ortho]
CB.out -> GB.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=recover; eyebrow=02 / Recuperación; title=La salida puede volver a leerse; example-title=What comes back; example-summary=Se conservan la colocación, el color, la curva y la topología, junto con fit=wires de un CNOT ajustado y su ausencia de etiqueta. -->

El modo `full` ya incorpora mucha información al marcado. Cada grupo de nodo incluye su ID, tipo, etiqueta, línea de origen y orientación, se sitúa mediante `translate` y recibe un token de color. Un grupo de cable incluye sus extremos y su red, además de su dominio de señal y el ancho del bus. Por tanto, la mayor parte de una declaración ya está en el marcado, sin leer.

```ts
import { parseSchematicSvg } from '@schemd/core/decompile';

const { components, connections, source, lost } = parseSchematicSvg(svg);
```

Es un escáner acotado de los atributos que escribe el renderizador, sin analizador XML, porque las únicas entradas que deben funcionar son los diagramas producidos por este compilador. Rechaza la salida `default` o `embedded-css`, ya que ese marcado no incluye atributos de interacción.

Se conservan el ID, el tipo, la etiqueta, las coordenadas, la orientación y el color de cada componente. El `fit=wires` de un componente se lee de `data-fit` y su posición recuperada es la ajustada, por lo que al recompilar vuelve a ajustarse al mismo lugar. Un componente declarado sin etiqueta se recupera sin ella: el CNOT de la figura se recupera como `cnot:RQ at (440, 220) #purple [fit=wires]`. Cada conexión conserva sus extremos, curva, color y marcadores, además del ancho de bus y el dominio de señal. Una conexión escrita con `trunk` incluye `data-wire-trunk` y se recupera como `trunk: true`. En ambos casos, cada red se dibuja como un árbol, por lo que el código recuperado vuelve a compilarse en el mismo dibujo.

Un [subcircuito](/docs/1.3/subcircuits) no se conserva como bloque. El SVG solo contiene los componentes aplanados, por lo que el resultado contiene `U1_RT` y `U1_RB`, sin `divider:U1`. La curva se lee del recorrido dibujado. Solo `bezier` emite `C`, y `ortho` avanza mediante pasos `H` y `V`.

```schemd bounds="880x440" title="What comes back"
prepare:RB0 "|0\rangle" at (120, 140) #blue
prepare:RB1 "|1\rangle" at (120, 300) #blue
cnot:RQ at (440, 220) #purple [fit=wires]
port:RO0 "x" at (760, 140) #emerald
port:RO1 "y" at (760, 300) #emerald

RB0.out -> RQ.in1 #blue [ortho]
RB1.out -> RQ.in2 #blue [ortho]
RQ.out1 -> RO0.in #purple [ortho]
RQ.out2 -> RO1.in #purple [ortho marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=lost; eyebrow=03 / Precisión; title=Qué no se recupera; example-title=A variant that does not come back; example-summary=Ambos aparecen como `data-node-kind="diode"` en el marcado. -->

La recuperación es parcial e indica qué partes faltan. Las opciones de familia como `type=` y `variant=` no se registran en ningún lugar que pueda leer un escáner y solo se conservan como texto dentro del `aria-label` de cada grupo. Un diodo recuperado es un diodo estándar aunque se haya declarado como Schottky.

```ts
recovery.lost;
// [{ code: 'component-variant', detail: 'Family options such as type= …' }, …]
```

Deliberadamente, no hay un `fidelity: 'exact'` junto a esa lista. Todo documento con un componente pierde algo, por lo que un indicador que solo pudiera contener un valor no aportaría información. La lista indica lo que se perdió.

Una entrada mal formada sigue el mismo principio. Se omite un grupo al que le falte algo que el modo `full` siempre escribe. Inventar una etiqueta, una línea de origen o una curva para un marcado editado después de la compilación introduciría una declaración fabricada en el código recuperado, lo que sería peor que reconocer que no se pudo leer el grupo.

El resultado describe fielmente la topología, la colocación y el color. No promete que al recompilar se reproduzcan los bytes originales. Las pruebas del propio compilador garantizan el alcance de la afirmación: el código recuperado vuelve a compilarse con la misma topología y la misma colocación, y es un punto fijo de la recuperación.

```schemd bounds="820x360" title="A variant that does not come back"
diode:DS1 "standard" at (250, 180) #rose
diode:DS2 "schottky" right-of DS1 by 200 #rose [type=schottky]

DS1.cathode -> DS2.anode #rose [line]
```

<!-- /schemd-section -->
