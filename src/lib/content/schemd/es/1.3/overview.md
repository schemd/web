<!-- schemd-doc: id=overview; label=Inicio rápido; title=Primeros pasos con schemd 1.3.1; summary=Compile diagramas de ingeniería de varios dominios en SVG con trazado de conexiones, determinista y accesible, e inspeccione el circuito que representan.; category=Primeros pasos; order=10 -->

`schemd` se pronuncia «skemd» (`/skɛmd/`). La versión 1.3 especifica los datos que acepta cada tipo de componente en una nueva entrada, `@schemd/core/schema`, y este sitio genera a partir de ella una [ficha técnica](/components) para cada tipo. Conserva las etiquetas opcionales de 1.2, de modo que una unión o un punto de prueba puede mostrar solo su designador, y todo lo que añadió 1.1: [`fit=wires`](/docs/1.3/fit) alinea las líneas de un CNOT con sus cúbits y los pines de un circuito integrado con los cables que los alimentan, y una alineación permite colocar un [terminal](/docs/1.3/placement#terminals) a la altura de otro componente. La base sigue siendo el compilador 1.0. Cada red se traza como un único árbol y los cables se unen en un componente de [unión](/docs/1.3/nets). El texto se mide a partir de los avances de la fuente y todos los problemas de un documento se notifican a la vez, con sus [columnas](/docs/1.3/diagnostics).

<!-- schemd-section: id=install; eyebrow=01 / Instalación; title=Compile en el servidor; example-title=Microphone preamplifier; example-summary=Un condensador de acoplamiento, una resistencia de polarización y un amplificador no inversor con una ganancia aproximada de 46. -->

El compilador se instala desde npm y recibe una cadena. No necesita DOM ni archivos de fuentes, por lo que se ejecuta durante una compilación o dentro de un controlador de solicitudes. También puede llamarse desde un worker del navegador o una prueba.

```sh
npm i @schemd/core
```

```ts
import { compileSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="1000x640" title="Microphone preamplifier"')!;
const { svg, document, metrics, sourceMap, routing } = compileSchematic(source, fence);
```

Una pasada devuelve varios resultados. `svg` es el dibujo y `document` es el modelo validado que lo sustenta. `metrics` registra el coste de la compilación, `sourceMap` vincula cada componente y cable con la línea que lo declaró y `routing` informa del trabajo que requirió el trazador. El modelo nunca se reconstruye analizando de nuevo el SVG.

Esta figura representa un preamplificador de micrófono. Un condensador bloquea el nivel de continua del micrófono, una resistencia de 100 kΩ mantiene la entrada del amplificador a tierra y el amplificador eleva la señal al nivel de línea. Como el circuito se declara mediante su topología, es posible razonar sobre él. Una etapa no inversora tiene una ganancia de

$$
A_v = 1 + \frac{R_F}{R_G}
$$

y con $R_F = 100\,\text{k}\Omega$ y $R_G = 2.2\,\text{k}\Omega$ es aproximadamente 46, o 33 dB. Esto resulta adecuado para un micrófono dinámico, cuya salida es de unos pocos milivoltios.

```schemd bounds="1000x640" title="Microphone preamplifier"
source:MIC "mic" at (90, 250) #blue [type=voltage-ac orientation=up]
capacitor:CIN "1 \mu F" at (240, 110) #cyan
junction:NB at (380, 110) #cyan
resistor:RB "100 k\Omega" at (380, 280) #amber [orientation=down]
amplifier:PRE "preamp" at (560, 130) #purple [type=opamp]
resistor:RF "100 k\Omega" at (560, 320) #amber
junction:NF at (440, 320) #purple
resistor:RG "2.2 k\Omega" at (440, 440) #amber [orientation=down]
port:OUT "line out" at (900, 130) #emerald
ground:AG at (240, 560) #slate

MIC.positive -> CIN.in #blue [ortho]
CIN.out -> NB.node #cyan [ortho]
NB.node -> PRE.positive #cyan [ortho]
NB.node -> RB.in #cyan [ortho]
PRE.out -> RF.out #purple [ortho]
RF.in -> NF.node #amber [ortho]
NF.node -> PRE.negative #purple [ortho]
NF.node -> RG.in #purple [ortho]
PRE.out -> OUT.in #emerald [ortho marker-end=arrow]
RB.out -> AG.in #slate [ortho]
RG.out -> AG.in #slate [ortho]
MIC.negative -> AG.in #slate [ortho]
```

Las dos uniones, `NB` y `NF`, no llevan etiquetas, por lo que cada una muestra solo su nombre. Todos los cables que llegan a ellas entran directamente en el punto, porque un componente de unión es el lugar que su autor eligió para conectarlos.

<!-- /schemd-section -->

<!-- schemd-section: id=migrate; eyebrow=02 / Migración; title=Pase al esquema de 1.3; example-title=Two-pole RC ladder; example-summary=Dos secciones RC en serie; las uniones y la tierra no llevan etiqueta. -->

1.3.0 no añadió sintaxis ni cambió ningún dibujo. El parche 1.3.1 descrito más abajo corrige los símbolos de polaridad de las fuentes. En 1.3.0, todos los documentos de 1.2 se compilaban con los mismos bytes: el corpus de 270 documentos del compilador era idéntico byte por byte al de 1.2.0 y la ruta de compilación conservaba su tamaño.

Lo que añade 1.3 es una descripción del lenguaje para las herramientas. `@schemd/core/schema` enumera todos los tipos de componentes con sus opciones, y para cada opción indica su tipo, los valores o el intervalo que acepta y su valor predeterminado:

```ts
import { SCHEMATIC_COMPONENT_SCHEMAS, describeComponentPorts } from '@schemd/core/schema';

SCHEMATIC_COMPONENT_SCHEMAS.mux.options.find((option) => option.name === 'inputs');
// { name: 'inputs', type: 'integer', min: 1, max: 32, default: 2, defaultsByType: { demux: 1 } }

describeComponentPorts('mux', { type: 'demux' });
// ['in1', 'out1', 'out2', 'select', 'enable']
```

Un editor puede enumerar lo que acepta un tipo sin copiar una tabla a mano, y la lista no puede desactualizarse, porque una prueba del compilador la verifica frente al analizador para cada tipo y opción. Los puertos dependen de las opciones, por lo que `describeComponentPorts` consulta al propio analizador. El esquema es una entrada independiente, de modo que una aplicación que solo compila nunca lo carga. La [referencia de componentes](/docs/1.3/component-reference#schema) amplía esta información.

Si se migra desde 1.1, siguen siendo aplicables las [notas de 1.2](/docs/1.2/overview#migrate): un componente puede declararse sin etiqueta y, en ese caso, muestra solo su designador.

```schemd bounds="980x480" title="Two-pole RC ladder"
port:VIN "V_{in}" at (90, 120) #blue
resistor:R1 "1 k\Omega" at (250, 120) #amber
junction:N1 at (400, 120) #cyan
capacitor:C1 "100 nF" at (400, 260) #cyan [orientation=down]
resistor:R2 "10 k\Omega" at (560, 120) #amber
junction:N2 at (710, 120) #cyan
capacitor:C2 "10 nF" at (710, 260) #cyan [orientation=down]
port:VOUT "V_{out}" at (880, 120) #emerald
ground:G1 at (560, 400) #slate

VIN.out -> R1.in #blue [ortho]
R1.out -> N1.node #amber [ortho]
N1.node -> C1.in #cyan [ortho]
N1.node -> R2.in #cyan [ortho]
R2.out -> N2.node #amber [ortho]
N2.node -> C2.in #cyan [ortho]
N2.node -> VOUT.in #emerald [ortho marker-end=arrow]
C1.out -> G1.in #slate [ortho]
C2.out -> G1.in #slate [ortho]
```

Ambas uniones y la tierra se declaran sin etiquetas. Los valores que importan, las dos resistencias y las dos capacitancias, son las únicas etiquetas de la hoja.

<!-- /schemd-section -->

<!-- schemd-section: id=patch-1-3-1; title=1.3.1: interprete correctamente la polaridad de las fuentes -->

La versión **1.3.1** corrige dibujos cuyas marcas de polaridad no coincidían con sus terminales. La gramática y el esquema de 1.3 no cambian, por lo que este parche comparte la documentación de 1.3.

- La placa larga de una batería aparece ahora junto a `positive`; la corta, junto a `negative`. Las versiones anteriores dibujaban las placas al revés.
- `voltage-dc`, `vcvs` y `ccvs` sitúan ahora `+` junto a `positive` y `−` junto a `negative`. Los signos permanecen verticales en todas las orientaciones.
- `current-dc`, `vccs` y `cccs` dibujan ahora su flecha sobre el eje de los terminales, desde `positive` hacia `negative`. Así se sigue la convención de SPICE para la corriente positiva que atraviesa una fuente.

Los puertos, los puertos de control de las fuentes dependientes, los límites y el trazado no se han movido. Los alias `in = negative` y `out = positive` no cambian. No hace falta editar el código ni las conexiones; vuelva a compilar los SVG guardados con **1.3.1 o posterior** para obtener los símbolos corregidos. Consulte las [convenciones de los terminales de las fuentes](/docs/1.3/component-reference#electrical) al interpretar dibujos anteriores.

Las notas de migración anteriores describen el esquema añadido en 1.3.0; su comparación byte por byte se refiere a 1.3.0, antes de estas correcciones de dibujo.

<!-- /schemd-section -->

<!-- schemd-section: id=limitations; eyebrow=03 / Límites; title=Lea esto antes de confiar en una compilación sin errores; example-title=Enable across an address bus; example-summary=Una línea de habilitación cruza tres líneas de dirección mediante puentes; un enlace de la red de direcciones las une con puntos. -->

Un documento que se compila es un dibujo que el compilador ha podido colocar y trazar. Esto no afirma que el circuito funcione. Una herramienta de este tipo puede fallar al dibujar con seguridad algo incorrecto, por lo que esta sección especifica hasta dónde llega esa seguridad.

- `verifyNetlist` solo realiza comprobaciones estructurales. Aplica reglas fijas a un modelo plano de las conexiones y no demuestra nada sobre el comportamiento analógico, la temporización, la impedancia ni la validez cuántica. Un resultado sin avisos significa que no se activó ninguna regla.
- El trazado es heurístico y acotado. Cada red se traza una vez sobre una retícula de canales, en un orden determinado por la geometría y nunca por el orden de declaración. Los conflictos restantes se negocian después durante un número limitado de rondas. Por ello, en los casos habituales los cables quedan donde los situaría un delineante, aunque no se demuestra que sea la solución óptima. Se rechaza un documento demasiado denso para la retícula y el error identifica el cable que no pudo colocarse.
- Una etiqueta ocupa el anclaje fijo de su componente y no tiene en cuenta a sus vecinos. En una hoja densa puede solaparse con otro componente o un cable, por lo que los componentes deben separarse al menos el ancho de una etiqueta.
- Varios cables con flecha que convergen en un pin pueden llegar desde los cuatro lados. Una punta de flecha nunca termina en una unión, por lo que cada conexión con flecha conserva su propio recorrido hasta el pin.
- Dos cables de una misma red pueden compartir ocasionalmente un tramo. Una búsqueda aleatoria amplia encontró este caso dos veces en 8,000 disposiciones y el dibujo seguía conectando lo que debía.
- Un componente `fit=wires` se coloca antes de ajustarse. La colocación relativa lo mide a partir de su forma sin ajustar, por lo que sus vecinos necesitan espacio para que crezca.
- El modelo subyacente es plano. Los subcircuitos se expanden en componentes ordinarios antes de que cualquier otra operación lea el documento, y la lista de conexiones, el SVG y el descompilador ven ese dibujo aplanado. No hay subhojas ni puertos entre páginas. Tampoco se ofrece simulación.
- `describeSchematic` informa sobre la conectividad y no asigna ningún arquetipo. Indica lo que demuestra la lista de conexiones, no la función del circuito.
- Las cifras de rendimiento publicadas son medianas en caliente obtenidas en una máquina. `bun run benchmark` proporciona las cifras para otro hardware.

```schemd bounds="860x500" title="Enable across an address bus"
port:A0 "A_0" at (100, 150) #emerald
port:A0O "A_0'" at (740, 150) #emerald
port:A1 "A_1" at (100, 240) #emerald
port:A1O "A_1'" at (740, 240) #emerald
port:A2 "A_2" at (100, 330) #emerald
port:A2O "A_2'" at (740, 330) #emerald
port:LINK "link" at (300, 75) #emerald [orientation=down]
port:LINKO "link'" at (300, 420) #emerald [orientation=up]
port:EN "EN" at (530, 75) #rose [orientation=down]
port:ENO "EN'" at (530, 420) #rose [orientation=up]

A0.out -> A0O.in #emerald [ortho net=ADDR]
A1.out -> A1O.in #emerald [ortho net=ADDR]
A2.out -> A2O.in #emerald [ortho net=ADDR]
LINK.out -> LINKO.out #emerald [ortho net=ADDR]
EN.out -> ENO.out #rose [ortho net=ENABLE]
```

La línea de habilitación pertenece a otra red, por lo que cruza cada línea de dirección mediante un puente. El enlace, en cambio, pertenece a la propia red de direcciones. Sus cruces son un conductor que se encuentra consigo mismo, y cada uno se marca con un punto.

<!-- /schemd-section -->
