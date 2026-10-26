<!-- schemd-doc: id=overview; label=Inicio rápido; title=Primeros pasos con schemd 1.2; summary=Compile diagramas de ingeniería de varios dominios en SVG con conexiones trazadas, deterministas y accesibles, e inspeccione el circuito que representan.; category=Primeros pasos; order=10 -->

`schemd` se pronuncia «skemd» (`/skɛmd/`). La versión 1.2 permite declarar un componente sin etiqueta, de modo que una unión o un punto de prueba solo muestra su identificador. Conserva todo lo que añadió la versión 1.1: [`fit=wires`](/docs/1.2/fit) alinea las líneas de un CNOT con sus cúbits y los pines de un circuito integrado con los cables que los alimentan; una alineación también puede situar un [terminal](/docs/1.2/placement#terminals) a la misma altura que otro componente. La base sigue siendo el compilador 1.0. Cada red se traza como un único árbol, y los cables se unen en un componente de [unión](/docs/1.2/nets). El texto se mide a partir de los avances de los caracteres de la fuente, y todos los problemas de un documento se notifican a la vez, con sus [columnas](/docs/1.2/diagnostics).

<!-- schemd-section: id=install; eyebrow=01 / Instalación; title=Compile en el servidor; example-title=RTD signal chain; example-summary=Una fuente de corriente excita un RTD de platino, un búfer lee su tensión y un filtro RC alimenta el convertidor. -->

El compilador se instala desde npm y recibe una cadena. No necesita DOM ni archivo de fuente, por lo que puede ejecutarse durante una compilación o dentro de un controlador de solicitudes. También puede llamarse desde un worker del navegador o una prueba.

```sh
npm i @schemd/core
```

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="1040x560" title="RTD signal chain"')!;
const { svg, document, metrics, sourceMap, routing } = compileSchematic(source, fence);
```

Una sola pasada devuelve varios resultados. `svg` es el dibujo y `document`, el modelo validado que lo sustenta. `metrics` registra el coste de la compilación, `sourceMap` vincula cada componente y cable con la línea que lo declaró, y `routing` informa del trabajo que tuvo que realizar el trazador. El modelo nunca se reconstruye mediante un análisis del SVG.

Esta figura muestra una etapa de entrada para medir temperatura. Una corriente constante atraviesa un termómetro de resistencia Pt100 y un búfer de ganancia unitaria reproduce la tensión entre sus extremos sin cargar el sensor. Después, un único polo RC limita el ancho de banda antes de que el convertidor tome las muestras. Como el circuito se declara mediante su topología, es posible razonar sobre él. La frecuencia de corte del filtro es

$$
f_c = \frac{1}{2\pi R_F C_F}
$$

y, con $R_F = 3.3\,\text{k}\Omega$ y $C_F = 10\,\text{nF}$, se sitúa cerca de $4.8\ \text{kHz}$. Esa frecuencia es muy superior a la velocidad con que puede cambiar una temperatura, por lo que el filtro elimina ruido sin alterar la lectura.

```schemd bounds="1040x560" title="RTD signal chain"
source:IX "I_{ex}" at (90, 250) #blue [type=current-dc orientation=up]
junction:NX at (250, 110) #blue
resistor:RT "Pt100" at (250, 290) #amber [type=thermistor orientation=down]
amplifier:BUF "buffer" at (450, 130) #cyan [type=opamp]
resistor:RF "3.3 k\Omega" at (660, 130) #amber
junction:NF at (820, 130) #cyan
capacitor:CF "10 nF" at (820, 290) #cyan [orientation=down]
ground:AG "AGND" at (820, 470) #slate
port:OUT "to ADC" at (960, 130) #emerald

IX.positive -> NX.node #blue [ortho]
NX.node -> RT.in #blue [ortho]
NX.node -> BUF.positive #blue [ortho]
BUF.out -> BUF.negative #cyan [ortho]
BUF.out -> RF.in #cyan [ortho]
RF.out -> NF.node #amber [ortho]
NF.node -> CF.in #cyan [ortho]
NF.node -> OUT.in #emerald [ortho marker-end=arrow]
CF.out -> AG.in #slate [ortho]
RT.out -> AG.in #slate [ortho]
IX.negative -> AG.in #slate [ortho]
```

Las dos uniones, `NX` y `NF`, se declaran sin etiquetas, por lo que cada una muestra solo su nombre. Cada cable que llega a ellas termina directamente en el punto, porque el componente de unión es el lugar que el autor eligió para conectarlos.

<!-- /schemd-section -->

<!-- schemd-section: id=migrate; eyebrow=02 / Migración; title=Pase a la versión 1.2 sin volver a dibujar nada; example-title=Divider, three parts unlabelled; example-summary=Una unión, la tierra de la resistencia inferior y el retorno no llevan texto de etiqueta. -->

La versión 1.2 solo añade funciones. Todos los documentos de la versión 1.1 se compilan en los mismos bytes: el corpus de 270 documentos del compilador produce resultados idénticos, byte a byte, a los de la versión 1.1.0. Un documento solo cambia donde su autor omite una etiqueta.

La etiqueta entre comillas ahora es opcional en ambas formas de declaración. `junction:J1 at (440, 90) #cyan` y `ground:G1 below R2 by 150 #slate` son declaraciones completas. Un componente de este tipo muestra su identificador encima y nada debajo; además, el trazador deja de reservar espacio para una fila de etiqueta que no existe. En el modelo, su `label` es la cadena vacía. Su nombre accesible en el modo `full` es `J1, junction`, `describeSchematic` lo nombra por su ID y `parseSchematicSvg` lo recupera sin etiqueta.

Un par de comillas vacío, `""`, sigue siendo inválido. Si un componente necesita una etiqueta, debe incluirla; si no la necesita, debe omitir las comillas.

La ruta de compilación ocupa 44,637 bytes con gzip, 35 bytes más que la versión 1.1.0. Si se migra desde la versión 1.0, siguen siendo aplicables las [notas de la versión 1.1](/docs/1.1/overview#migrate): `fit=wires`, la alineación de terminales y el terminal vertical de la línea inferior de una puerta con varias líneas, orientado hacia abajo.

```schemd bounds="760x480" title="Divider, three parts unlabelled"
source:VS "12 V" at (100, 210) #blue [type=voltage-dc orientation=up]
resistor:R1 "10 k\Omega" at (270, 90) #amber
junction:J1 at (440, 90) #cyan
resistor:R2 "4.7 k\Omega" at (440, 240) #amber [orientation=down]
port:VO "V_{out}" at (640, 90) #emerald
ground:G1 at (440, 410) #slate

VS.positive -> R1.in #blue [ortho]
R1.out -> J1.node #amber [ortho]
J1.node -> R2.in #cyan [ortho]
J1.node -> VO.in #emerald [ortho marker-end=arrow]
R2.out -> G1.in #slate [ortho]
VS.negative -> G1.in #slate [ortho]
```

Antes de la versión 1.2, la unión debía escribirse como `junction:J1 "J1"`, y su nombre se dibujaba dos veces. Aquí, las únicas etiquetas de la hoja son la tensión de alimentación y las dos resistencias.

<!-- /schemd-section -->

<!-- schemd-section: id=limitations; eyebrow=03 / Límites; title=Lea esto antes de confiar en una compilación sin errores; example-title=Clock across a data bus; example-summary=Una línea de reloj cruza tres líneas de datos mediante puentes; una derivación de la red de datos las une con puntos. -->

Un documento que se compila es un dibujo que el compilador ha podido colocar y trazar. Eso no demuestra que el circuito funcione. Una herramienta así falla cuando dibuja algo incorrecto con aparente seguridad; esta sección indica hasta dónde llega esa seguridad.

- `verifyNetlist` solo realiza comprobaciones estructurales. Aplica reglas fijas a un modelo plano de las conexiones y no demuestra nada sobre el comportamiento analógico, la temporización, la impedancia ni la validez cuántica. Un resultado sin avisos significa que no se activó ninguna regla.
- El trazado es heurístico y tiene límites. Cada red se traza una vez sobre una retícula de canales, en un orden derivado de la geometría y nunca del orden de declaración. Después, los conflictos restantes se negocian durante un número limitado de rondas. Por eso, en los casos habituales, los cables quedan donde los situaría un delineante, aunque no se demuestra que sea la solución óptima. Un documento demasiado denso para la retícula se rechaza y el error identifica el cable que no se pudo colocar.
- Cada etiqueta ocupa un anclaje fijo de su componente y no tiene en cuenta los elementos vecinos. En una hoja densa puede solaparse con otro componente o un cable, por lo que conviene separar los componentes al menos una distancia equivalente al ancho de una etiqueta.
- Varios cables con flechas que convergen en un pin pueden llegar a él desde sus cuatro lados. Las puntas de flecha nunca terminan en una unión, por lo que cada conexión con flecha conserva su propio recorrido hasta el pin.
- Dos cables de una misma red pueden compartir un tramo en ocasiones. Una búsqueda aleatoria amplia encontró este caso dos veces en 8,000 disposiciones, y el dibujo seguía conectando los elementos correctos.
- Un componente con `fit=wires` se coloca antes de ajustarse. La colocación relativa lo mide a partir de su forma sin ajustar, por lo que sus vecinos necesitan dejarle espacio para crecer.
- El modelo subyacente es plano. Los subcircuitos se expanden en componentes ordinarios antes de que cualquier otra operación lea el documento; la lista de conexiones, el SVG y el descompilador ven ese dibujo aplanado. No hay subhojas ni puertos entre páginas. Tampoco se ofrece simulación.
- `describeSchematic` informa de la conectividad y no asigna ningún tipo de circuito. Indica lo que demuestra la lista de conexiones, no para qué sirve el circuito.
- Las cifras de rendimiento publicadas son medianas de ejecuciones en caliente en una sola máquina. `bun run benchmark` proporciona las cifras para otro hardware.

```schemd bounds="840x520" title="Clock across a data bus"
port:D0 "D_0" at (100, 160) #emerald
port:D0O "D_0'" at (720, 160) #emerald
port:D1 "D_1" at (100, 260) #emerald
port:D1O "D_1'" at (720, 260) #emerald
port:D2 "D_2" at (100, 360) #emerald
port:D2O "D_2'" at (720, 360) #emerald
port:TAP "tap" at (270, 70) #emerald [orientation=down]
port:TAPO "tap'" at (270, 450) #emerald [orientation=up]
port:CLK "CLK" at (500, 70) #amber [orientation=down]
port:CLKO "CLK'" at (500, 450) #amber [orientation=up]

D0.out -> D0O.in #emerald [ortho net=DATA]
D1.out -> D1O.in #emerald [ortho net=DATA]
D2.out -> D2O.in #emerald [ortho net=DATA]
TAP.out -> TAPO.out #emerald [ortho net=DATA]
CLK.out -> CLKO.out #amber [ortho net=CLOCK]
```

El reloj pertenece a otra red, por lo que cruza cada línea de datos mediante un puente. La derivación, en cambio, pertenece a la propia red de datos. Sus cruces representan un conductor que se encuentra consigo mismo, y cada uno se marca con un punto.

<!-- /schemd-section -->
