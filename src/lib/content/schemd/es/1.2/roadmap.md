<!-- schemd-doc: id=roadmap; label=Hoja de ruta; title=Qué incluye la versión 1.2 y qué sigue pendiente; summary=Funciones listas para publicar, comprobaciones de verificación, orden de publicación y límites ajenos al compilador.; category=Contribuir; order=110 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Las ilustraciones de la hoja de ruta muestran formas, no un circuito completo. -->

<!-- schemd-section: id=complete; eyebrow=01 / Versión; title=La versión 1.2 permite omitir la etiqueta de un componente; example-title=Cross-domain 1.2 specimen -->

La versión 1.2 hace opcional la etiqueta entre comillas. Una unión, un punto de prueba o una puerta cuyo símbolo ya indica qué es se pueden declarar sin ella y muestran solo su identificador. Todos los documentos de la versión 1.1 se compilan en los mismos bytes, y el cambio añade 35 bytes a la ruta de compilación. La solicitud surgió del convertidor de CircuiTikZ en desarrollo en [schemd/circuitikz](https://github.com/schemd/circuitikz), que no tiene ninguna etiqueta que asignar a un componente al que el código TeX no puso etiqueta.

La versión 1.1 añadió [`fit=wires`](/docs/1.2/fit), que alinea las líneas de una puerta de varios cúbits o los pines de un bloque con los cables que llegan a ellos, y alineaciones que sitúan un [terminal](/docs/1.2/placement#terminals) a la altura de otro componente. Ejecutar la búsqueda de disposiciones con componentes ajustados también reveló dos defectos, y ambos se corrigieron. Una conexión repetida entre extremos de uniones bloqueaba el compilador; además, el terminal de la línea inferior de una puerta de varias líneas apuntaba hacia arriba, de modo que un cable dirigido a él atravesaba los terminales superiores.

La versión 1.0 reconstruyó el núcleo del compilador manteniendo el mismo lenguaje y la misma API. Cada red se traza una vez sobre una retícula de enteros y crece como un árbol; los conflictos se resuelven mediante negociación con PathFinder. Los cables dirigidos a una unión se encuentran en ella, y un cable que cruza su propia red recibe un punto. Toda la geometría usa enteros exactos en milésimas de unidad, y el texto se mide con los avances de Arial. Cada terminal de un bloque digital tiene una posición propia, y `diagnoseSchematic` informa de todos los problemas de un documento a la vez, con sus columnas.

Las versiones anteriores siguen formando parte del mismo compilador: los subcircuitos y la sintaxis de troncos de la versión 0.8, `snapshotSchematic` y `parseSchematicSvg` de la versión 0.6, la colocación relativa de la versión 0.5 y la eliminación de los límites globales de componentes y conexiones de la versión 0.4. También se conservan la geometría con giros de cuarto de vuelta, las primitivas tipadas, la semántica de redes, las comprobaciones de colisiones, la inspección de listas de conexiones, las reglas de diseño estructurales, las descripciones accesibles, las pruebas aleatorias deterministas y los mapas de código fuente.

`^1.2.0` es la versión que se debe instalar. En la línea 1.0, la versión 1.0.1 es el código de la 1.0.0 con un número nuevo, porque se etiquetó antes de integrar las correcciones previstas; la versión 1.0.2 incluye esas correcciones.

Se conoce un defecto en la versión 1.2. El símbolo de batería dibuja su placa larga, la positiva, en el lado del terminal `negative`, por lo que todas las baterías parecen invertidas. Las conexiones son correctas y `buildNetlist` informa de la polaridad adecuada. Se espera que una versión de parche corrija el problema intercambiando ambas placas.

```schemd bounds="980x420" title="Cross-domain 1.2 specimen"
source:AC3 "AC" at (90, 120) #purple [type=voltage-ac]
capacitor:CX3 "C" at (280, 120) #cyan
register:RG3 "REG" at (500, 120) #amber
sgate:QS3 at (710, 120) #blue
component:RIG3 "test rig" at (870, 290) #slate [width=150 height=80]
```

<!-- /schemd-section -->

<!-- schemd-section: id=verification; eyebrow=02 / Comprobaciones; title=Publique core antes de que lo consuma el sitio web; example-title=Release signal -->

Las comprobaciones de publicación ejecutan la verificación de tipos y mantienen la cobertura de sentencias, ramas, funciones y líneas en el 100%. Ejecutan pruebas aleatorias de propiedades con límites y una búsqueda de propiedades con semilla sobre disposiciones aleatorias, que exige a cada dibujo las reglas que un delineante comprueba a simple vista. Deben detectarse los 122 mutantes específicos, un corpus de 270 documentos debe mantener resultados idénticos byte a byte y deben coincidir seis imágenes de referencia de píxeles de Chromium. Completan las comprobaciones las pruebas del paquete instalado, los límites de gzip y brotli-11, y los máximos de latencia y escalado. Un generador aleatorio de contratos modifica documentos reales como lo hace un editor en mitad de una pulsación. Después comprueba que `compileSchematic` solo lance `SchematicSyntaxError`, que `diagnoseSchematic` nunca lance excepciones y que ambos coincidan.

Esas comprobaciones demuestran las propiedades que verifican. No demuestran que un circuito sea eléctricamente seguro, correcto en el tiempo, certificado conforme a una norma ni fabricable.

El orden de publicación es fijo y está automatizado. Al enviar una etiqueta, se publica `@schemd/core` en npm y se crea la versión de GitHub a partir de la sección de esa versión en `CHANGELOG.md`, de modo que la prosa se escribe una sola vez. El flujo de publicación rechaza una etiqueta cuya versión no tenga una entrada en el registro de cambios y lo comprueba antes de que llegue nada a npm. Después, una tarea programada del sitio web adopta la versión. Actualiza conjuntamente la dependencia y el archivo de bloqueo, regenera la instantánea de la versión a partir del propio packument de npm, ejecuta todas las comprobaciones web y abre una solicitud de incorporación. Nada se integra automáticamente, porque una versión del compilador puede cambiar la geometría renderizada, y esa es la parte que CI no puede juzgar.

El orden importa porque un `dist/` enlazado solo demuestra la integración local. Nunca demuestra que el archivo tar publicado y su mapa de exportaciones funcionen. Solo lo demuestra una instalación desde el registro; por eso, la tarea instala y nunca enlaza.

```schemd bounds="700x300" title="Release signal"
logic:HI3 "1" at (100, 120) #purple [type=high]
testpoint:TAG3 "tag v1.2.0" at (340, 120) #cyan
load:LMP3 "lamp" at (590, 120) #emerald [type=lamp]

HI3.out -> TAG3.node #purple [digital line]
TAG3.node -> LMP3.in #emerald [digital line]
```

Algunos límites son deliberados. La rotación se limita a cuartos de vuelta. El texto se mide para una lista de fuentes sin motor tipográfico y se coloca sin tener en cuenta a sus vecinos. Varios cables con flechas que convergen en un pin pueden llegar a él desde sus cuatro lados, y dos cables de una misma red pueden compartir un tramo en ocasiones. Un componente ajustable se coloca antes de ajustarse. Los subcircuitos se aplanan en un modelo único y nunca se convierten en subhojas. Las reglas de diseño son estructurales, sin SPICE, análisis temporal ni verificación formal. El trazado es determinista y negociado, pero tiene límites y no se demuestra que sea óptimo; además, una conversión entre un escalar y un bus se rechaza, nunca se supone. Deben leerse las páginas de [limitaciones](/docs/1.2/overview#limitations) y [límites de recursos](/docs/1.2/limits) antes de tratar código fuente no confiable como una carga de trabajo del servidor.

<!-- /schemd-section -->
