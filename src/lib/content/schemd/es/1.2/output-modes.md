<!-- schemd-doc: id=output-modes; label=Modos de salida; title=Elija el modo SVG más pequeño que conserve lo necesario; summary=La salida estática, el CSS de tema integrado y los mecanismos semánticos completos comparten una geometría idéntica.; category=Publicar resultados; order=60 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Estos ejemplos muestran el marcado emitido, no conectividad. -->

<!-- schemd-section: id=modes; eyebrow=01 / Salida; title=Separe la geometría de los datos de interacción; example-title=One drawing, three modes -->

| Modo           | Añade                                                                               | Adecuado para                                                    |
| -------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `default`      | solo SVG estático accesible                                                         | artículos, exportaciones aptas para correo y recursos inmutables |
| `embedded-css` | tema aislado y clases de estado                                                     | documentos adaptables con tema                                   |
| `full`         | atributos de datos para nodos, puertos, cables, líneas de código fuente y topología | correspondencias y simulaciones del área de pruebas              |

Todos los modos comparten un documento analizado, una disposición, un conjunto de trazados y un viewBox. Solo cambian los estilos y los metadatos. El dibujo nunca se mueve. El SVG sin procesar del área de pruebas es la cadena exacta que muestra Render View; no se reconstruye ninguna instantánea del DOM a partir de ella.

Con los mecanismos de cables activados, cada cable de señal incluye su topología resuelta como `data-net-id`. Una red con nombre conserva el nombre del autor; una sin nombre usa una identidad estable `$N`. El mapa de código fuente de la compilación expone el mismo valor como `SchematicWireSource.netId`; los conectores UML que solo representan una relación lo omiten. Cada punto de unión que dibuja el trazador lleva la clase `schematic-junction`, por lo que el entorno puede dar a las uniones un estilo distinto del de los terminales. Esto incluye el punto donde una rama se incorpora al conductor de su red y el punto donde un cable cruza su propia red.

Una conexión escrita con `trunk` sigue incluyendo `data-wire-trunk`, y un componente declarado con `fit=wires` incluye `data-fit="wires"`, para que el descompilador pueda recuperar ambos. Un componente declarado sin etiqueta no emite texto de etiqueta y, en modo `full`, su `data-node-label` está vacío. La raíz `<svg>` establece la lista de fuentes medidas, `Arial, Helvetica, 'Liberation Sans', Arimo, sans-serif`, como valor predeterminado.

```schemd bounds="760x320" title="One drawing, three modes"
source:CC "coin cell" at (90, 130) #blue [type=battery]
switch:TG "toggle" at (300, 130) #amber [type=spst]
load:LP "lamp" at (540, 130) #emerald [type=lamp]

CC.positive -> TG.in #blue [line]
TG.out -> LP.in #emerald [line]
```

El modo `full` conserva los ID locales del diagrama y proporciona objetivos de puerto accesibles. Nunca se insertan scripts ni fuentes externas. Tampoco imágenes ráster, URL de datos ni `foreignObject`.

<!-- /schemd-section -->

<!-- schemd-section: id=optimization; eyebrow=02 / Bytes; title=Reutilice símbolos canónicos; example-title=Repeated LEDs -->

Los componentes idénticos comparten una sola definición `<symbol>`. Una orientación solo añade una rotación de la instancia. Una puerta o un bloque [ajustado](/docs/1.2/fit) solo comparte su definición con componentes cuyos terminales hayan quedado en las mismas posiciones, porque su forma depende de sus cables. Una familia que el diagrama no usa no le añade bytes. Por eso, un dibujo grande compuesto por pocos componentes distintos ocupa poco.

```schemd bounds="820x300" title="Repeated LEDs"
diode:LA at (130, 120) #emerald [type=led]
diode:LB at (350, 120) #emerald [type=led orientation=down]
diode:LC at (580, 120) #emerald [type=led orientation=up]
```

Los tres LED comparten un símbolo y no llevan etiquetas, por lo que cada instancia solo añade una referencia, una rotación y su identificador.

<!-- /schemd-section -->
