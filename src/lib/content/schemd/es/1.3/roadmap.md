<!-- schemd-doc: id=roadmap; label=Hoja de ruta; title=Qué publicó 1.3 y qué sigue pendiente; summary=Capacidades listas para publicar, comprobaciones de verificación, orden de publicación y límites externos al compilador.; category=Contribuir; order=110 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Las ilustraciones de la hoja de ruta esbozan formas, no un circuito completo. -->

<!-- schemd-section: id=complete; eyebrow=01 / Versión; title=1.3 describe cada tipo mediante datos; example-title=Cross-domain 1.3 specimen -->

1.3 especifica lo que acepta cada tipo de componente mediante datos. `@schemd/core/schema` proporciona las opciones de cada tipo, con sus tipos de datos, intervalos y valores predeterminados, y `describeComponentPorts` consulta al analizador los terminales de un componente con cualquier conjunto de opciones. Una prueba del compilador verifica el esquema frente al analizador para cada tipo y opción, por lo que no puede desactualizarse. La compilación no cambia: el corpus de 270 documentos es idéntico byte por byte al de 1.2.0 y las [fichas técnicas de componentes](/components) de este sitio se generan a partir de la nueva entrada.

1.2 hizo opcional la etiqueta entre comillas. Una unión, un punto de prueba o una puerta cuyo símbolo ya indica lo que es pueden declararse sin ella y muestran solo su designador. Todos los documentos de 1.1 se compilaban con los mismos bytes y el cambio añadió 35 bytes a la ruta de compilación. La solicitud procedía del conversor de CircuiTikZ que se está desarrollando en [schemd/circuitikz](https://github.com/schemd/circuitikz), que no dispone de una etiqueta para un componente que el TeX dejó sin etiquetar.

1.1 añadió [`fit=wires`](/docs/1.3/fit), que alinea las líneas de una puerta de varios cúbits o los pines de un bloque con los cables que llegan a ellos, y alineaciones que colocan un [terminal](/docs/1.3/placement#terminals) a la altura de otro componente. Ejecutar la búsqueda de distribución con componentes ajustados también encontró dos defectos y ambos se corrigieron. Una conexión repetida entre extremos de uniones hacía fallar el compilador, y el terminal de la línea inferior de una puerta de varias líneas apuntaba hacia arriba, por lo que un cable hacia él pasaba por los terminales superiores.

1.0 reconstruyó el núcleo del compilador manteniendo el mismo lenguaje y la misma API. Cada red se traza una vez sobre una retícula de enteros y crece como un árbol, y los conflictos se eliminan mediante negociación con PathFinder. Los cables declarados hacia una unión se encuentran en ella y un cable que cruza su propia red recibe un punto. Toda la geometría utiliza enteros exactos en milésimas de unidad y el texto se mide según los avances de Arial. Cada terminal de un bloque digital tiene su propia posición y `diagnoseSchematic` informa a la vez de todos los problemas de un documento, con sus columnas.

Las versiones anteriores siguen formando parte del mismo compilador: los subcircuitos y la sintaxis trunk de 0.8, `snapshotSchematic` y `parseSchematicSvg` de 0.6, la colocación relativa de 0.5 y la eliminación en 0.4 de los límites globales de componentes y conexiones. También se conservan la geometría de giros de un cuarto de vuelta, las primitivas tipadas, la semántica de redes, las comprobaciones de colisión, la inspección de listas de conexiones, las reglas estructurales de diseño, las descripciones accesibles, las pruebas aleatorias deterministas y los mapas de origen.

`^1.3.0` es la versión que debe instalarse. En la línea 1.0, 1.0.1 es el código de 1.0.0 con un número nuevo, porque se etiquetó antes de integrar las correcciones previstas; 1.0.2 contiene esas correcciones.

Hay un defecto conocido en 1.3, como lo había en 1.2. El símbolo de batería dibuja su placa larga, la positiva, en el lado del terminal `negative`, por lo que todas las baterías parecen invertidas. Las conexiones son correctas y `buildNetlist` informa de la polaridad adecuada. Se espera una corrección que intercambie las dos placas en una versión de parche.

```schemd bounds="980x420" title="Cross-domain 1.3 specimen"
source:PU4 "pulse" at (90, 120) #purple [type=voltage-pulse]
inductor:LX4 "L" at (280, 120) #cyan
decoder:DC4 "DEC" at (500, 120) #amber
hadamard:HQ4 at (710, 120) #blue
component:BOX4 "fixture" at (870, 290) #slate [width=150 height=80]
```

<!-- /schemd-section -->

<!-- schemd-section: id=verification; eyebrow=02 / Comprobación; title=Publique core antes de que el sitio web lo utilice; example-title=Release signal -->

La comprobación de publicación ejecuta la comprobación de tipos y mantiene al 100% la cobertura de sentencias, ramas, funciones y líneas. Ejecuta pruebas de propiedades con entradas aleatorias acotadas y una búsqueda de propiedades con semilla sobre disposiciones aleatorias, que somete cada dibujo a las reglas que un delineante comprueba visualmente. Deben detectarse los 129 mutantes específicos, un corpus de 270 documentos debe seguir siendo idéntico byte por byte y deben coincidir seis imágenes de referencia de Chromium. Las pruebas de límites del paquete instalado, los presupuestos gzip y brotli-11 y los límites de latencia y escalabilidad completan la comprobación. Un generador de pruebas de contrato altera documentos reales del mismo modo que un editor a mitad de una pulsación. Después comprueba que `compileSchematic` solo lance `SchematicSyntaxError`, que `diagnoseSchematic` nunca lance excepciones y que ambos coincidan.

Estas comprobaciones demuestran las propiedades que verifican. No demuestran que un circuito sea eléctricamente seguro, correcto en el tiempo, certificado conforme a una norma o fabricable.

El orden de publicación es fijo y está automatizado. El envío de una etiqueta publica `@schemd/core` en npm y crea la publicación de GitHub a partir de la sección de esa versión en `CHANGELOG.md`, de modo que el texto se escribe una vez. El flujo de publicación rechaza una etiqueta cuya versión no tenga una entrada en el registro de cambios y lo comprueba antes de que nada llegue a npm. Después, una tarea programada del sitio web adopta la versión. Actualiza conjuntamente la dependencia y el archivo de bloqueo, regenera la instantánea de versiones a partir del documento de metadatos del propio npm, ejecuta todas las comprobaciones web y abre una solicitud de cambios. Nada se integra por sí solo, ya que una versión del compilador puede cambiar la geometría renderizada y esa es la parte que la integración continua no puede juzgar.

El orden importa porque un `dist/` enlazado solo demuestra integración local. Nunca demuestra que funcionen el archivo publicado y su mapa de exportaciones. Solo lo demuestra una instalación desde el registro y, por ese motivo, la tarea instala y nunca enlaza.

```schemd bounds="700x300" title="Release signal"
logic:HI4 "1" at (100, 120) #purple [type=high]
testpoint:TAG4 "tag v1.3.0" at (340, 120) #cyan
load:BZ4 "buzzer" at (590, 120) #emerald [type=buzzer]

HI4.out -> TAG4.node #purple [digital line]
TAG4.node -> BZ4.in #emerald [digital line]
```

Algunos límites se mantienen deliberadamente. La rotación se limita a cuartos de vuelta. El texto se mide para una sola pila de fuentes sin motor tipográfico y se coloca sin tener en cuenta a sus vecinos. Varios cables con flecha que convergen en un pin pueden llegar desde los cuatro lados, y dos cables de una misma red pueden compartir ocasionalmente un tramo. Un componente ajustado se coloca antes de ajustarse. Los subcircuitos se aplanan en un único modelo y nunca se convierten en subhojas. Las reglas de diseño son estructurales, sin SPICE, temporización ni verificación formal. El trazado es determinista y negociado, pero acotado y sin garantía de ser óptimo, y una conversión entre una señal escalar y un bus se rechaza, sin inferirla. Deben leerse las páginas de [limitaciones](/docs/1.3/overview#limitations) y [presupuestos de recursos](/docs/1.3/limits) antes de tratar código no confiable como carga de trabajo de un servidor.

<!-- /schemd-section -->
