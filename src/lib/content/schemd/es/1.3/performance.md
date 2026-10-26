<!-- schemd-doc: id=performance; label=Rendimiento; title=Mida la escalabilidad y limite cada aplicación; summary=Distinga el rendimiento del compilador, el coste del paquete, la amplificación de respuestas y los límites que debe añadir un servicio público.; category=Operar con seguridad; order=100 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Estos ejemplos miden el rendimiento de la geometría, no la conectividad. -->

<!-- schemd-section: id=budgets; eyebrow=01 / Compilador; title=Considere la escalabilidad y el tamaño como presupuestos distintos; example-title=A bounded route around a bracket -->

Desde 0.4 no hay un límite predeterminado del número de componentes o conexiones. Es una capacidad del compilador y no autoriza a ningún endpoint público a aceptar trabajo arbitrario. Es fácil confundir ambas cosas y hacerlo resulta costoso. Siempre que el código proceda de otras fuentes, deben establecerse `components`, `connections`, `sourceCharacters`, `wireCrossings` y `svgOutputBytes` mediante la opción [`limits`](/docs/1.3/limits) de cada compilación.

Además sigue siendo necesario un plazo máximo de tiempo real. Todos esos campos limitan un tamaño y ninguno limita el tiempo. Un documento pequeño con una geometría complicada puede ser costoso de trazar y ningún recuento de bytes de salida lo detectará.

```schemd bounds="800x360" title="A bounded route around a bracket"
port:PI "P" at (70, 100) #violet
inductor:LI "L" at (330, 100) #purple [orientation=down]
component:BRK "bracket" at (330, 250) #slate [width=150 height=70]
port:QI "Q" at (700, 100) #emerald

PI.out -> LI.in #violet [ortho]
LI.out -> QI.in #emerald [ortho]
```

La comprobación de publicación mide dos costes para el cliente, cada uno con gzip y con brotli-11. Una aplicación que importe solo `compileSchematic` y elimine el código no utilizado debe mantenerse por debajo de 44 KiB gzip y 38.5 KiB brotli. La entrada pública completa, que incluye exportaciones que una aplicación concreta quizá nunca llame, debe mantenerse por debajo de 47 KiB gzip y 41 KiB brotli. 1.3 mide 44,637 bytes y 47,717 bytes gzip, unos 43.6 KiB y 46.6 KiB, igual que 1.2. Ambas cifras son presupuestos para el código empaquetado. No dicen nada sobre el tamaño de las declaraciones de TypeScript, el archivo de npm, los archivos instalados ni una ruta del sitio web. `bun run size` sobre el commit exacto de la versión proporciona la medida real; una captura del registro no lo hace.

1.3 no añade nada a ninguna de las dos cifras. Su esquema de componentes es una entrada independiente, `@schemd/core/schema`, de 16,465 bytes gzip, con su propio presupuesto de 16.5 KiB, y una aplicación que solo compila nunca lo carga. La mayor parte de esos bytes corresponde al registro de símbolos, al que `describeComponentPorts` consulta los terminales de cada tipo. Antes, las etiquetas opcionales añadieron 35 bytes a la ruta de compilación en 1.2, dentro de los presupuestos establecidos por 1.1. La versión 1.1 había añadido 1.8 KiB: unos 1.4 KiB de código para el [ajuste](/docs/1.3/fit), la alineación de terminales y dos correcciones de distribución, y 0.4 KiB para los siete diagnósticos que indican qué terminal no puede alinearse y qué altura lo permitiría. `fit` es una opción que lee el analizador de cada tipo, por lo que no puede eliminarse mediante tree shaking.

Antes de eso, 1.0 aumentó la ruta de compilación en unos 4.5 KiB respecto a 0.8 y conviene explicar el motivo. La reconstrucción eliminó el antiguo trazador con su reordenación y recuperación mediante retirada de cables, los desplazamientos de grupos y los condicionales paralelos por tipo. Ese espacio se destinó al trazado por red con negociación de congestión, un índice espacial que mantiene la compilación lineal, geometría exacta con enteros, texto medido y el modelo de diagnósticos de `diagnoseSchematic`. La pila de trazado contiene la mayor parte de los bytes y es código, que se comprime peor que las plantillas a las que sustituyó. Queda una posibilidad: trasladar el texto de los diagnósticos detrás de códigos, y este proyecto no la utiliza. Un diagnóstico que no explica cómo corregir el diagrama es en sí mismo un defecto.

La escalabilidad se comprueba por separado y la compilación sigue siendo lineal. Un índice de cuadrícula uniforme sobre obstáculos, cables y etiquetas permite que una búsqueda lea solo su propia ventana, y 10,000 componentes se compilan en aproximadamente un cuarto de segundo.

En la máquina en la que se escribió esta página, un bus de inversión de doce cables con conflictos se compila en 1.38 ms; la ruta de compilación de 1.3 es el código de 1.2, por lo que la cifra sirve para ambas. El mismo bus tardaba 16.6 ms en 0.8, antes de que 1.0 empezara a trazarlo en la primera pasada, porque el límite de búsqueda cuenta ahora los codos inevitables por la orientación de un pin. Un trazado denso de 16×16 tarda 14.5 ms, frente a 4.1 ms en 0.8. Cada uno de sus 32 destinos está detrás de una columna de componentes muy juntos, y rodear cada uno con margen requiere trabajo real sobre una retícula más fina. Un documento sencillo cuesta unos 0.31 ms.

Estas son medianas en caliente de una máquina. La afirmación duradera es la pendiente comprobada, no los valores absolutos en milisegundos. `bun run benchmark` proporciona las cifras para otro hardware y debe ejecutarse antes de citar cualquiera de ellas.

<!-- /schemd-section -->

<!-- schemd-section: id=server-cache; eyebrow=02 / Aplicación; title=Aísle los plazos y limite la amplificación; example-title=Cache-key reference -->

El endpoint oficial de compilación aplica límites más estrictos que los valores predeterminados de la biblioteca. Rechaza cuerpos de solicitud demasiado grandes antes de asignar memoria para JSON, limita la frecuencia de solicitudes por cliente y ejecuta cada compilación fuera del hilo de la solicitud. Un plazo máximo puede terminar ese worker, mientras que `Promise.race` alrededor de una compilación síncrona no puede hacerlo. La concurrencia y la profundidad de la cola son finitas, y una cola llena devuelve un error de capacidad que permite reintentar, por lo que la memoria nunca se multiplica por la ráfaga que admite el límite de frecuencia.

```schemd bounds="720x300" title="Cache-key reference"
clock:CKV "CLK" at (90, 120) #amber
flipflop:FJ "JK" at (340, 120) #cyan [type=jk]
port:QV "Q" at (620, 120) #emerald

CKV.out -> FJ.clock #amber [digital ortho]
FJ.q -> QV.in #emerald [digital ortho]
```

Las compilaciones correctas y las fallidas con números de línea comparten una caché LRU con clave SHA-256, limitada a 64 entradas y 16 MiB. La clave incluye el modo, los límites, el título y el código fuente, y un acierto actualiza la antigüedad de la entrada. Los datos del registro utilizan una instantánea inmutable que se revalida cuando está desactualizada, con una sola actualización en curso. Las cachés de documentación y simulación usan claves de registros finitos, nunca entradas del usuario.

El editor del navegador compila localmente, en un worker nativo que contiene `@schemd/core` y solo se inicia cuando se necesita. Recurre al endpoint cuando el worker no está disponible. Por tanto, escribir normalmente no requiere un viaje de ida y vuelta por la red ni trabajo del servidor, y el límite del worker permite que un plazo máximo detenga una compilación local patológica. El compilador también queda fuera de las rutas críticas de las páginas de documentación, catálogo y simulación. El presupuesto de compilación del sitio web comprueba ambas condiciones a partir del manifiesto de Vite.

El trabajo de rendimiento no termina cuando una prueba de rendimiento pasa. `bun run benchmark` debe repetirse en el hardware de destino, y p95 y p99 bajo carga concurrente importan más que una mediana en caliente. Antes de aumentar cualquier presupuesto de un servicio público, debe medirse la respuesta serializada además del tiempo del analizador.

<!-- /schemd-section -->
