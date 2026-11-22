<!-- schemd-doc: id=performance; label=Rendimiento; title=Mida la escalabilidad y limite cada aplicación; summary=Distinga el rendimiento del compilador, el coste del paquete, la amplificación de respuestas y los límites que debe añadir un servicio público.; category=Operar con seguridad; order=100 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Estos ejemplos miden el rendimiento de la geometría, no la conectividad. -->

<!-- schemd-section: id=budgets; eyebrow=01 / Compilador; title=Considere la escalabilidad y el tamaño como presupuestos distintos; example-title=A bounded route around a bracket -->

Desde 0.4 no hay un límite predeterminado del número de componentes o conexiones. Es una capacidad del compilador y no autoriza a ningún endpoint público a aceptar trabajo arbitrario. Es fácil confundir ambas cosas y hacerlo resulta costoso. Siempre que el código proceda de otras fuentes, deben establecerse `components`, `connections`, `sourceCharacters`, `wireCrossings` y `svgOutputBytes` mediante la opción [`limits`](/docs/1.4/limits) de cada compilación.

Además sigue siendo necesario un plazo máximo de tiempo real. Todos esos campos limitan un tamaño y ninguno limita el tiempo. Un documento pequeño con una geometría complicada puede ser costoso de trazar y ningún recuento de bytes de salida lo detectará.

```schemd bounds="800x360" title="A bounded route around a bracket"
port:PI "P" at (70, 100) #purple
inductor:LI "L" at (330, 100) #purple [orientation=down]
component:BRK "bracket" at (330, 250) #slate [width=150 height=70]
port:QI "Q" at (700, 100) #emerald

PI.out -> LI.in #violet [ortho]
LI.out -> QI.in #emerald [ortho]
```

La comprobación de publicación mide dos costes para el cliente, cada uno con gzip y con brotli-11. Una aplicación que importe solo `compileSchematic` y elimine el código no utilizado debe mantenerse por debajo de 46 KiB gzip y 40 KiB brotli. La entrada pública completa, que incluye exportaciones que una aplicación concreta quizá nunca llame, debe mantenerse por debajo de 49 KiB gzip y 42.5 KiB brotli. 1.4.0 mide 46,395 bytes y 49,493 bytes gzip — incorporando las hojas medidas (`bounds="auto"`) y la colocación inicial, al tiempo que reduce el directorio `dist/` distribuido en más de un 53% frente a la salida sin minificar de `tsc` (209,354 bytes en total). Ambas cifras son presupuestos para el código empaquetado. No dicen nada sobre el tamaño de las declaraciones de TypeScript, el archivo de npm, los archivos instalados ni una ruta del sitio web. `bun run size` sobre el commit exacto de la versión proporciona la medida real; una captura del registro no lo hace.

1.3 añadió el esquema de componentes como una entrada independiente, `@schemd/core/schema`, que empezó en 16,465 bytes gzip en 1.3.0 porque `describeComponentPorts` incluía el registro de símbolos. En 1.4.0, `describeComponentPorts` deriva los puertos canónicos y valida las opciones de forma autónoma, reduciendo `@schemd/core/schema` un 75.5% hasta 4,059 bytes gzip (3,631 bytes brotli-11), bajo un presupuesto ajustado de 4.5 KiB gzip, y una aplicación que solo compila nunca lo carga. Antes, las etiquetas opcionales añadieron 35 bytes a la ruta de compilación en 1.2, dentro de los presupuestos establecidos por 1.1. La versión 1.1 había añadido 1.8 KiB: unos 1.4 KiB de código para el [ajuste](/docs/1.4/fit), la alineación de terminales y dos correcciones de distribución, y 0.4 KiB para los siete diagnósticos que indican qué terminal no puede alinearse y qué altura lo permitiría. `fit` es una opción que lee el analizador de cada tipo, por lo que no puede eliminarse mediante tree shaking.

Antes de eso, 1.0 aumentó la ruta de compilación en unos 4.5 KiB respecto a 0.8 y conviene explicar el motivo. La reconstrucción eliminó el antiguo trazador con su reordenación y recuperación mediante retirada de cables, los desplazamientos de grupos y los condicionales paralelos por tipo. Ese espacio se destinó al trazado por red con negociación de congestión, un índice espacial que mantiene la compilación lineal, geometría exacta con enteros, texto medido y el modelo de diagnósticos de `diagnoseSchematic`. La pila de trazado contiene la mayor parte de los bytes y es código, que se comprime peor que las plantillas a las que sustituyó. Queda una posibilidad: trasladar el texto de los diagnósticos detrás de códigos, y este proyecto no la utiliza. Un diagnóstico que no explica cómo corregir el diagrama es en sí mismo un defecto.

La escalabilidad se comprueba por separado y la compilación sigue siendo lineal. Un índice de cuadrícula uniforme sobre obstáculos, cables y etiquetas permite que una búsqueda lea solo su propia ventana, y 10,000 componentes se compilan en bastante menos de un cuarto de segundo.

En la máquina en la que se escribió esta página, 1.4.0 compila un bus de inversión de doce cables con conflictos en 0.87 ms (frente a 1.68 ms en 1.3.1, −48% a −53%). El trazado denso de 16×16 baja de 16.15 ms a 3.19 ms (−80%), una hoja de 512 componentes pasa de 3.11 ms a 1.13 ms (−64%) y un documento sencillo se compila en 0.24 ms en frío y 0.11 ms en caliente (frente a 0.34 ms). Todo documento que declare sus límites y posiciones sigue siendo idéntico byte por byte al de 1.3.1.

Estas son medianas en caliente de una máquina. La afirmación duradera es la pendiente comprobada, no los valores absolutos en milisegundos. `bun run benchmark` proporciona las cifras para otro hardware y debe ejecutarse antes de citar cualquiera de ellas.

<!-- /schemd-section -->

<!-- schemd-section: id=server-cache; eyebrow=02 / Aplicación; title=Aísle los plazos y limite la amplificación; example-title=Cache-key reference -->

El endpoint oficial de compilación aplica límites más estrictos que los valores predeterminados de la biblioteca. Rechaza cuerpos de solicitud demasiado grandes antes de asignar memoria para JSON, limita la frecuencia de solicitudes por cliente y ejecuta cada compilación fuera del hilo de la solicitud. Un plazo máximo puede terminar ese worker, mientras que `Promise.race` alrededor de una compilación síncrona no puede hacerlo. La concurrencia y la profundidad de la cola son finitas, y una cola llena devuelve un error de capacidad que permite reintentar, por lo que la memoria nunca se multiplica por la ráfaga que admite el límite de frecuencia.

```schemd bounds="720x300" title="Cache-key reference"
clock:CKV "CLK" at (90, 120) #emerald
flipflop:FJ "JK" at (340, 120) #cyan [type=jk]
port:QV "Q" at (620, 120) #emerald

CKV.out -> FJ.clock #amber [digital ortho]
FJ.q -> QV.in #emerald [digital ortho]
```

Las compilaciones correctas y las fallidas con números de línea comparten una caché LRU con clave SHA-256, limitada a 64 entradas y 16 MiB. La clave incluye el modo, los límites, el título y el código fuente, y un acierto actualiza la antigüedad de la entrada. Los datos del registro utilizan una instantánea inmutable que se revalida cuando está desactualizada, con una sola actualización en curso. Las cachés de documentación y simulación usan claves de registros finitos, nunca entradas del usuario.

El editor del navegador compila localmente, en un worker nativo que contiene `@schemd/core` y solo se inicia cuando se necesita. Recurre al endpoint cuando el worker no está disponible. Por tanto, escribir normalmente no requiere un viaje de ida y vuelta por la red ni trabajo del servidor, y el límite del worker permite que un plazo máximo detenga una compilación local patológica. El compilador también queda fuera de las rutas críticas de las páginas de documentación, catálogo y simulación. El presupuesto de compilación del sitio web comprueba ambas condiciones a partir del manifiesto de Vite.

El trabajo de rendimiento no termina cuando una prueba de rendimiento pasa. `bun run benchmark` debe repetirse en el hardware de destino, y p95 y p99 bajo carga concurrente importan más que una mediana en caliente. Antes de aumentar cualquier presupuesto de un servicio público, debe medirse la respuesta serializada además del tiempo del analizador.

<!-- /schemd-section -->
