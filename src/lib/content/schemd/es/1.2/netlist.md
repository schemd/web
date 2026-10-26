<!-- schemd-doc: id=netlist; label=API de listas de conexiones; title=Inspeccione el circuito, además del dibujo; summary=Extraiga nodos, redes y aristas de un documento validado y compruebe siete reglas de diseño.; category=Crear diagramas; order=45 -->

La mayoría de las herramientas que convierten texto en diagramas terminan en una imagen. schemd puede ir más allá, porque el analizador ya resuelve la topología de la red y la pasada de disposición ya enumera los puertos; así, el mismo código fuente que se renderiza también se puede inspeccionar. `buildNetlist` devuelve esa conectividad y `verifyNetlist` aplica reglas de diseño sobre ella. `inspectSchematic` realiza ambas operaciones en una llamada. Las tres son funciones puras que no renderizan nada, no calculan geometría y no realizan operaciones de entrada o salida.

<!-- schemd-section: id=model; eyebrow=01 / Modelo; title=Lo que el compilador ya conoce; example-title=Supply, pump and return -->

Una lista de conexiones tiene tres partes. `nodes` contiene los componentes declarados con sus nombres de puerto estables. `nets` contiene los conjuntos de terminales que el documento une. Cada red incluye el nombre asignado por el autor, si lo hay, los dominios de señal y las anchuras de bus observados, y las líneas de código fuente que contribuyeron a ella. `edges` contiene las propias conexiones declaradas, que se conservan para que un diagnóstico pueda señalar la línea que lo originó.

Los terminales que comparten exactamente un nodo forman una red, tal como los ve el renderizador. La forma en que se dibuja una red no cambia nada aquí. Cada red de varios terminales se dibuja como un [árbol](/docs/1.2/nets), y un cable que cruza su propia red recibe un punto; aun así, todos los puntos de ese conductor son el mismo nodo. Por tanto, las redes, las aristas y los resultados de las reglas dependen únicamente de lo declarado. Un componente declarado sin etiqueta aparece con un `label` vacío.

```schemd bounds="900x400" title="Supply, pump and return"
source:VM "24 V" at (110, 150) #blue [type=voltage-dc]
load:MT "pump" at (390, 150) #amber [type=motor]
ground:MR "return" at (680, 150) #slate

VM.positive -> MT.in #blue [line]
MT.out -> MR.in #slate [line]
VM.negative -> MR.in #slate [ortho]
```

```ts
import { inspectSchematic, parseSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="900x400" title="Pump"')!;
const { netlist, diagnostics } = inspectSchematic(parseSchematic(source, fence));

netlist.nodes[0].ports; // ['negative', 'positive']
netlist.nets.length; // 2
diagnostics; // []
```

<!-- /schemd-section -->

<!-- schemd-section: id=rules; eyebrow=02 / Reglas; title=Siete comprobaciones, cada una con un código estable; example-title=A shorted rail -->

Cada diagnóstico incluye un código que se puede comprobar, una gravedad y los elementos implicados. También incluye la línea de código fuente cuando una declaración es responsable del problema. Los diagnósticos se ordenan por gravedad, después por línea y finalmente por código, por lo que la salida de una comprobación es lo bastante estable para una prueba de instantánea o un registro de CI.

| Código                    | Gravedad  | Se activa cuando                                                                                              |
| ------------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| `shorted-supply`          | `error`   | Dos líneas de alimentación (un positivo de fuente, una línea de alimentación o una tierra) comparten una red. |
| `width-mismatch`          | `error`   | Una red contiene conexiones que declaran distintas anchuras de bus.                                           |
| `domain-mismatch`         | `error`   | Una red mezcla dominios de señal, como cuántico y digital.                                                    |
| `unconnected-component`   | `warning` | Un componente declarado no participa en ninguna conexión.                                                     |
| `duplicate-connection`    | `warning` | El mismo par de terminales está conectado más de una vez.                                                     |
| `multiple-drivers`        | `warning` | Dos salidas digitales controlan la misma red.                                                                 |
| `disconnected-subcircuit` | `info`    | El diagrama contiene más de un grupo conectado independiente.                                                 |

El diagrama siguiente conecta la alimentación directamente a tierra mediante un nombre de red compartido. Se renderiza porque la geometría es válida, pero no supera la comprobación:

<!-- schemd-expect: shorted-supply -->

```schemd bounds="900x400" title="A shorted rail"
source:VM "24 V" at (110, 150) #blue [type=voltage-dc]
load:MT "pump" at (390, 150) #amber [type=motor]
ground:MR "return" at (680, 150) #slate

VM.positive -> MT.in #blue [line net=v24]
MT.out -> MR.in #slate [line net=v24]
```

```text
error  shorted-supply  line 5  Net v24 ties supply rails VM, MR together.
```

<!-- /schemd-section -->

<!-- schemd-section: id=discipline; eyebrow=03 / Criterio; title=Por qué las reglas tienen un alcance limitado; example-title=Two outputs, one node -->

Un comprobador que genera falsas alarmas es peor que no tener ninguno; por eso, cada regla es deliberadamente conservadora.

El terminal `negative` de una fuente que comparte un nodo con tierra es el camino de retorno de casi cualquier circuito. Solo dos líneas de alimentación en una red cuentan como cortocircuito; una línea y su retorno nunca cuentan como tal. Dos terminales analógicos que comparten un nodo son topología ordinaria, sin conflicto de control, por lo que `multiple-drivers` solo se aplica a dominios digitales. Los puertos sin usar en un componente también son normales. Solo merece una advertencia un componente que no participa en ninguna conexión.

El diagrama siguiente presenta un conflicto de control porque así lo indica su dominio:

<!-- schemd-expect: multiple-drivers -->

```schemd bounds="900x460" title="Two outputs, one node"
port:BTNA "BUTTON_A" at (110, 150) #violet
port:BTNB "BUTTON_B" at (110, 330) #violet
and:G6 "AND" at (470, 240) #purple

BTNA.out -> G6.in1 #violet [digital]
BTNB.out -> G6.in1 #violet [digital]
```

```text
warning  multiple-drivers  line 5  Net $1 is driven by BTNA.out, BTNB.out.
```

`SCHEMATIC_RULES` publica todos los códigos con su gravedad y un resumen de una línea. El entorno puede generar esta tabla a partir de ellos, filtrar por gravedad o hacer fallar una compilación solo ante errores, sin codificar las cadenas de forma fija.

<!-- /schemd-section -->
