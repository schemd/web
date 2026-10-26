<!-- schemd-doc: id=netlist; label=API de lista de conexiones; title=Inspeccione el circuito además del dibujo; summary=Extraiga nodos, redes y aristas de un documento validado y compruebe siete reglas de diseño.; category=Crear diagramas; order=45 -->

La mayoría de las herramientas que convierten texto en diagramas terminan en una imagen. schemd puede ir más allá, porque el analizador ya resuelve la topología de las redes y la pasada de distribución ya enumera los puertos, por lo que también puede inspeccionarse el código que se renderiza. `buildNetlist` devuelve esa conectividad y `verifyNetlist` aplica reglas de diseño sobre ella. `inspectSchematic` realiza ambas operaciones en una llamada. Las tres son funciones puras que no renderizan nada, no calculan geometría ni realizan operaciones de E/S.

<!-- schemd-section: id=model; eyebrow=01 / Modelo; title=Lo que el compilador ya sabe; example-title=Supply, heater and return -->

Una lista de conexiones tiene tres partes. `nodes` contiene los componentes declarados con sus nombres estables de puertos. `nets` contiene los conjuntos de terminales que conecta el documento. Cada red incluye el nombre que le dio el autor, si lo hay, los dominios de señal y anchos de bus observados en ella, y las líneas de origen que contribuyeron a formarla. `edges` contiene las propias conexiones declaradas, conservadas para que un diagnóstico pueda apuntar a la línea que lo causó.

Los terminales que comparten un nodo exacto pertenecen a una misma red, tal como los interpreta el renderizador. La forma de dibujar una red no cambia nada aquí. Cada red con varios terminales se dibuja como un [árbol](/docs/1.3/nets), y un cable que cruza su propia red recibe un punto, pero todos los puntos de ese conductor son el mismo nodo. Por tanto, las redes, las aristas y los resultados de las reglas dependen solo de lo declarado. Un componente declarado sin etiqueta aparece con un `label` vacío.

```schemd bounds="900x400" title="Supply, heater and return"
source:VH2 "48 V" at (110, 150) #blue [type=voltage-dc]
load:HT2 "heater" at (390, 150) #amber [type=lamp]
ground:HR2 "return" at (680, 150) #slate

VH2.positive -> HT2.in #blue [line]
HT2.out -> HR2.in #slate [line]
VH2.negative -> HR2.in #slate [ortho]
```

```ts
import { inspectSchematic, parseSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="900x400" title="Heater"')!;
const { netlist, diagnostics } = inspectSchematic(parseSchematic(source, fence));

netlist.nodes[0].ports; // ['negative', 'positive']
netlist.nets.length; // 2
diagnostics; // []
```

<!-- /schemd-section -->

<!-- schemd-section: id=rules; eyebrow=02 / Reglas; title=Siete comprobaciones, cada una con un código estable; example-title=A shorted rail -->

Un diagnóstico incluye un código que puede comprobarse, una gravedad y los elementos implicados. También incluye la línea de origen cuando el fallo corresponde a una declaración. Los diagnósticos se ordenan por gravedad, después por línea y finalmente por código, de modo que la salida de una comprobación es suficientemente estable para una prueba de instantáneas o un registro de integración continua.

| Código                    | Gravedad  | Falla cuando                                                                                             |
| ------------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `shorted-supply`          | `error`   | Dos líneas de alimentación —el positivo de una fuente, una alimentación o una tierra— comparten una red. |
| `width-mismatch`          | `error`   | Una red contiene conexiones que declaran anchos de bus distintos.                                        |
| `domain-mismatch`         | `error`   | Una red mezcla dominios de señal, como cuántico y digital.                                               |
| `unconnected-component`   | `warning` | Un componente declarado no participa en ninguna conexión.                                                |
| `duplicate-connection`    | `warning` | El mismo par de terminales se conecta más de una vez.                                                    |
| `multiple-drivers`        | `warning` | Dos salidas digitales controlan la misma red.                                                            |
| `disconnected-subcircuit` | `info`    | El diagrama contiene más de un grupo conectado independiente.                                            |

El siguiente diagrama conecta la alimentación directamente a tierra mediante un nombre de red compartido. Se renderiza porque la geometría es válida, pero no supera la comprobación:

<!-- schemd-expect: shorted-supply -->

```schemd bounds="900x400" title="A shorted rail"
source:VH2 "48 V" at (110, 150) #blue [type=voltage-dc]
load:HT2 "heater" at (390, 150) #amber [type=lamp]
ground:HR2 "return" at (680, 150) #slate

VH2.positive -> HT2.in #blue [line net=v48]
HT2.out -> HR2.in #slate [line net=v48]
```

```text
error  shorted-supply  line 5  Net v48 ties supply rails VH2, HR2 together.
```

<!-- /schemd-section -->

<!-- schemd-section: id=discipline; eyebrow=03 / Criterio; title=Por qué las reglas tienen un alcance limitado; example-title=Two outputs, one node -->

Un comprobador que genera falsas alarmas es peor que no disponer de uno, por lo que cada regla es deliberadamente conservadora.

Que el terminal `negative` de una fuente comparta un nodo con tierra es el camino de retorno de casi todos los circuitos dibujados. Solo dos líneas de alimentación en una misma red cuentan como cortocircuito; una alimentación y su retorno nunca lo hacen. Dos terminales analógicos que comparten un nodo constituyen una topología normal, sin conflicto, por lo que `multiple-drivers` solo se aplica a dominios digitales. Los puertos sin utilizar de un componente también son normales. Solo merece una advertencia un componente que no participa en ninguna conexión.

El siguiente diagrama presenta un conflicto porque así lo indica su dominio:

<!-- schemd-expect: multiple-drivers -->

```schemd bounds="900x460" title="Two outputs, one node"
port:IRQA "IRQ_A" at (110, 150) #violet
port:IRQB "IRQ_B" at (110, 330) #violet
nor:G7N "NOR" at (470, 240) #purple

IRQA.out -> G7N.in1 #violet [digital]
IRQB.out -> G7N.in1 #violet [digital]
```

```text
warning  multiple-drivers  line 5  Net $1 is driven by IRQA.out, IRQB.out.
```

`SCHEMATIC_RULES` publica todos los códigos con su gravedad y un resumen de una línea. Una aplicación puede generar esta tabla a partir de ellos, filtrar por gravedad o hacer fallar una compilación solo por los errores, sin fijar cadenas en el código.

<!-- /schemd-section -->
