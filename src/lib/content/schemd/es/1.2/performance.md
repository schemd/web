<!-- schemd-doc: id=performance; label=Rendimiento; title=Mida el escalado y limite cada entorno; summary=Distinga el rendimiento del compilador, el coste del paquete, la amplificación de respuesta y los límites que debe añadir un servicio público.; category=Operar con seguridad; order=100 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Estos ejemplos miden el rendimiento de la geometría, no la conectividad. -->

<!-- schemd-section: id=budgets; eyebrow=01 / Compilador; title=Trate el escalado y el tamaño como límites distintos; example-title=Bounded route around a heatsink -->

Desde la versión 0.4 no hay un límite predeterminado de componentes ni de conexiones. Esa es una capacidad del compilador, y no autoriza a ningún endpoint público a aceptar trabajo arbitrario. Es fácil confundir ambas cosas, y hacerlo resulta costoso. Siempre que el código fuente proceda de otros orígenes, se deben establecer `components`, `connections`, `sourceCharacters`, `wireCrossings` y `svgOutputBytes` mediante la opción [`limits`](/docs/1.2/limits) de cada compilación.

Además, sigue siendo necesario un plazo máximo de tiempo real. Todos esos campos limitan un tamaño; ninguno limita el tiempo. Un documento pequeño con una geometría difícil puede ser costoso de trazar, y ningún recuento de bytes de salida detectará ese coste.

```schemd bounds="800x360" title="Bounded route around a heatsink"
port:PR "P" at (70, 100) #violet
resistor:RR "R" at (330, 100) #amber [orientation=down]
component:HSK "heatsink" at (330, 250) #slate [width=150 height=70]
port:QR "Q" at (700, 100) #emerald

PR.out -> RR.in #violet [ortho]
RR.out -> QR.in #emerald [ortho]
```

Las comprobaciones de publicación miden dos costes del cliente, cada uno con gzip y brotli-11. Un entorno que importa solo `compileSchematic` y elimina el resto mediante tree shaking debe quedar por debajo de 44 KiB con gzip y 38.5 KiB con brotli. El punto de entrada público completo, que incluye exportaciones a las que un entorno quizá nunca llame, debe quedar por debajo de 47 KiB con gzip y 41 KiB con brotli. La versión 1.2 mide 44,637 bytes y 47,717 bytes con gzip, aproximadamente 43.6 KiB y 46.6 KiB. Ambas cifras son límites para el código empaquetado. No indican nada sobre el tamaño de las declaraciones de TypeScript, el archivo tar de npm, los archivos instalados ni una ruta del sitio web. `bun run size` en el commit exacto de publicación proporciona la medida real; una captura del registro no lo hace.

Las etiquetas opcionales añaden 35 bytes a la ruta de compilación, por lo que la versión 1.2 se mantiene dentro de los límites fijados por la versión 1.1. La versión 1.1 había añadido 1.8 KiB: aproximadamente 1.4 KiB de código para el [ajuste](/docs/1.2/fit), la alineación de terminales y dos correcciones de disposición, y 0.4 KiB para los siete diagnósticos que indican qué terminal no se puede alinear y qué altura lo permitiría. `fit` es una opción que lee el analizador de todos los tipos, por lo que no puede eliminarse mediante tree shaking.

Antes, la versión 1.0 había aumentado la ruta de compilación en unos 4.5 KiB respecto a la versión 0.8, y conviene explicar el motivo con claridad. La reconstrucción eliminó el trazador anterior, con su reordenación, su recuperación mediante retirada de cables, su desplazamiento de haces y sus ramas paralelas por tipo. El espacio se dedicó al trazado por red con congestión negociada, un índice espacial que mantiene lineal la compilación, geometría entera exacta, texto medido y el modelo de diagnósticos de `diagnoseSchematic`. La pila de trazado ocupa la mayor parte de los bytes y es código, que se comprime peor que las plantillas a las que sustituyó. Queda una posibilidad: trasladar la prosa de los diagnósticos detrás de códigos. Este proyecto no la utiliza. Un diagnóstico que no indica cómo corregir el diagrama es en sí mismo un defecto.

El escalado se comprueba por separado, y la compilación sigue siendo lineal. Un índice de retícula uniforme sobre obstáculos, cables y etiquetas permite que una búsqueda lea solo su propia ventana; 10,000 componentes se compilan en aproximadamente un cuarto de segundo.

En la máquina donde se escribió esta página, la versión 1.2 compila un bus de inversión de doce cables con conflictos en 1.38 ms. El mismo bus tardaba 16.6 ms en la versión 0.8, antes de que la versión 1.0 empezara a trazarlo en la primera pasada, porque el límite de búsqueda ahora cuenta los giros que la orientación de un pin hace inevitables. El trazado denso de 16×16 tarda 14.5 ms, frente a 4.1 ms en la versión 0.8. Cada uno de sus 32 destinos está detrás de una columna de componentes muy juntos, y rodear cada uno dejando espacio requiere trabajo en una retícula más fina. Un documento sencillo cuesta aproximadamente 0.31 ms.

Estas son medianas de ejecuciones en caliente en una sola máquina. Lo que se garantiza a largo plazo es la pendiente de escalado comprobada, no los valores absolutos en milisegundos. `bun run benchmark` proporciona las cifras para otro hardware y debe ejecutarse antes de citar cualquiera de ellas.

<!-- /schemd-section -->

<!-- schemd-section: id=server-cache; eyebrow=02 / Entorno; title=Aísle los plazos máximos y limite la amplificación; example-title=Cache-key reference -->

El endpoint oficial de compilación aplica límites más estrictos que los valores predeterminados de la biblioteca. Rechaza cuerpos de solicitud demasiado grandes antes de asignar memoria para JSON, limita la frecuencia de solicitudes por cliente y ejecuta cada compilación fuera del hilo de la solicitud. Un plazo máximo puede terminar ese worker; un `Promise.race` alrededor de una compilación síncrona no puede hacerlo. La concurrencia y la profundidad de la cola son finitas, y una cola llena devuelve un error de capacidad que permite reintentar, por lo que la memoria nunca se multiplica por la ráfaga que admite el límite de frecuencia.

```schemd bounds="720x300" title="Cache-key reference"
clock:CKU "CLK" at (90, 120) #amber
counter:CTU "CTR" at (340, 120) #cyan
port:QU "Q_0" at (620, 120) #emerald

CKU.out -> CTU.clock #amber [digital ortho]
CTU.out1 -> QU.in #emerald [digital ortho]
```

Las compilaciones correctas y las fallidas con números de línea comparten una caché LRU con claves SHA-256, limitada a 64 entradas y 16 MiB. La clave incluye el modo, los límites del lienzo, el título y el código fuente; un acierto actualiza la antigüedad de la entrada. Los datos del registro usan una instantánea inmutable que se revalida cuando está obsoleta, con una sola actualización en curso. Las cachés de documentación y simulación usan claves de registros finitos, nunca de entradas del usuario.

El editor del navegador compila localmente en un worker nativo que contiene `@schemd/core` y solo se inicia cuando hace falta. Recurre al endpoint cuando el worker no está disponible. Por tanto, la escritura normal no requiere viajes de ida y vuelta por la red ni trabajo del servidor, y el límite del worker permite que un plazo máximo detenga una compilación local patológica. El compilador también permanece fuera de las rutas críticas de las páginas de documentación, catálogo y simulación. El límite de compilación del sitio comprueba ambos hechos a partir del manifiesto de Vite.

El trabajo de rendimiento no termina cuando pasa una sola prueba de referencia. Se debe repetir `bun run benchmark` en el hardware de destino; los percentiles p95 y p99 con carga concurrente importan más que una mediana en caliente. También debe medirse la respuesta serializada, además del tiempo del analizador, antes de aumentar cualquier límite en un entorno público.

<!-- /schemd-section -->
