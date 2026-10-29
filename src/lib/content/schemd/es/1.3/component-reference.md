<!-- schemd-doc: id=component-reference; label=API de componentes; title=Utilice cada primitiva de 1.3 de forma deliberada; summary=Todas las familias, variantes, opciones, puertos semánticos y orientaciones canónicas.; category=Crear diagramas; order=40 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- La referencia muestra cada primitiva de forma aislada; conectar todos los ejemplos ocultaría el símbolo que muestran. -->

Todas las familias que tienen dirección utilizan `orientation=right` como valor predeterminado. Un nodo que tiene el mismo aspecto en todas las direcciones, como `junction`, rechaza la opción. Se siguen aceptando alias, pero los nombres de estas tablas son los que emite el compilador. Un alias se convierte a su terminal canónico antes de que lo reciba cualquier operación posterior, por lo que estos son los nombres que debe utilizar una aplicación como claves. Todos los tipos aceptan una declaración sin etiqueta, y ese componente muestra solo su designador. Cada tipo también tiene una [ficha técnica](/components) en este sitio, generada a partir de la descripción del propio compilador.

<!-- schemd-section: id=electrical; eyebrow=01 / Electricidad; title=Fuentes, conectividad, conmutación e instrumentos; example-title=Relay fan drive -->

| Tipo                    | Variantes de `type`                                                                                                | Puertos estables                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `source`                | `voltage-dc`, `voltage-ac`, `voltage-pulse`, `current-dc`, `current-ac`, `battery`, `vcvs`, `vccs`, `ccvs`, `cccs` | `negative`, `positive`; las fuentes dependientes añaden `control-positive`, `control-negative` |
| `junction`, `testpoint` | —                                                                                                                  | `node`                                                                                         |
| `connector`             | —                                                                                                                  | `in`, `out`                                                                                    |
| `power`                 | `vcc`, `vdd`, `vss`, `positive`, `negative`                                                                        | `in`                                                                                           |
| `switch`                | `spst`, `spdt`, `pushbutton`, `relay`                                                                              | `in`, `out`; SPDT: `common`, `normally-open`, `normally-closed`; relé: `coil1`, `coil2`        |
| `protection`            | `fuse`, `breaker`                                                                                                  | `in`, `out`                                                                                    |
| `amplifier`             | `opamp`, `comparator`, `instrumentation`                                                                           | `positive`, `negative`, `out`, `v+`, `v-`                                                      |
| `resonator`             | `crystal`, `ceramic`                                                                                               | `in`, `out`                                                                                    |
| `meter`                 | `voltmeter`, `ammeter`                                                                                             | `in`, `out`                                                                                    |
| `load`                  | `lamp`, `motor`, `speaker`, `buzzer`                                                                               | `in`, `out`                                                                                    |

En **1.3.1 y posteriores**, la placa larga de una batería marca `positive`. Las fuentes de tensión (`voltage-dc`, `vcvs`, `ccvs`) sitúan `+` en `positive` y `−` en `negative`; las flechas de las fuentes de corriente (`current-dc`, `vccs`, `cccs`) apuntan desde `positive` hacia `negative`, según la convención de SPICE para la corriente que atraviesa una fuente. Los alias son `in = negative` y `out = positive`. Los dibujos se corrigen en todas las orientaciones; las coordenadas de los terminales y las conexiones no cambian. Las [notas del parche](/docs/1.3/overview#patch-1-3-1) explican cómo actualizar los SVG guardados.

```schemd bounds="1040x430" title="Relay fan drive"
connector:J7 "12 V" at (90, 150) #slate
protection:FU7 "fuse" at (270, 150) #amber [type=fuse]
switch:K7 "relay" at (470, 150) #cyan [type=relay]
meter:V7 "V" at (670, 150) #purple [type=voltmeter]
load:M7 "fan" at (870, 150) #emerald [type=motor]
testpoint:TP7 at (470, 330) #cyan

J7.out -> FU7.in #slate [line]
FU7.out -> K7.in #amber [line]
K7.out -> V7.in #cyan [line]
V7.out -> M7.in #emerald [line marker-end=arrow]
K7.coil1 -> TP7.node #cyan [ortho]
```

Un relé representa dos circuitos en un símbolo. `in` y `out` conducen la carga, y `coil1` y `coil2` conducen el control que lo cierra, por lo que un relé nunca necesita un segundo componente para mostrar qué lo acciona. El relé anterior conmuta el ventilador y su terminal `coil1` se lleva a un punto de prueba. Ese punto de prueba no lleva etiqueta, porque el designador ya lo identifica.

<!-- /schemd-section -->

<!-- schemd-section: id=passives-semiconductors; eyebrow=02 / Electricidad; title=Componentes pasivos y variantes de semiconductores; example-title=Five further variants -->

Los componentes pasivos comparten `in` y `out`, y los diodos exponen `anode` y `cathode`. Un transistor se controla por `base` en un BJT y por `gate` en un FET o IGBT. Sus otros terminales son `collector` y `emitter`, o `drain` y `source`.

| Tipo         | Variantes                                                                        |
| ------------ | -------------------------------------------------------------------------------- |
| `resistor`   | `fixed`, `variable`, `rheostat`, `potentiometer`, `thermistor`, `ldr`            |
| `capacitor`  | `fixed`, `variable`, `polarized`                                                 |
| `inductor`   | `fixed`, `coupled`, `transformer`                                                |
| `diode`      | `standard`, `schottky`, `zener`, `led`, `photodiode`, `varactor`, `scr`, `triac` |
| `transistor` | `npn`, `pnp`, `nmos`, `pmos`, `njfet`, `pjfet`, `nigbt`, `pigbt`                 |
| `port`       | `width=1..256` opcional; `in`, `out`                                             |
| `ground`     | `signal`, `earth`, `chassis`; `in`                                               |

```schemd bounds="1040x430" title="Five further variants"
resistor:RH7 "rheostat" at (100, 150) #amber [type=rheostat]
capacitor:CV7 "variable" at (290, 150) #cyan [type=variable orientation=down]
inductor:TX7 "transformer" at (480, 150) #purple [type=transformer]
diode:DV7 "varactor" at (670, 150) #blue [type=varactor]
transistor:QG7 "p-IGBT" at (860, 150) #emerald [type=pigbt orientation=up]
```

Una variante cambia el símbolo, pero nunca el contrato de puertos. Tanto un reóstato como una resistencia fija se conectan de `in` a `out`. Por tanto, sustituir uno por otro requiere cambiar una palabra, sin modificar las conexiones.

<!-- /schemd-section -->

<!-- schemd-section: id=digital; eyebrow=03 / Digital; title=Lógica, bloques secuenciales y buses explícitos; example-title=Batch counter datapath -->

Las puertas clásicas son `and`, `or`, `not`, `nand`, `nor`, `xor` y `xnor`. Utilizan `in1..inN` y `out1..outN` indexados y aceptan `standard=ieee|iec`.

| Tipo                 | Variantes de `type`                                                     | Puertos especiales estables                                       |
| -------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `buffer`             | `plain`, `tristate`, `tristate-inverter`, `schmitt`, `schmitt-inverter` | `in1`, `out1`; los triestado añaden `enable`                      |
| `logic`              | `high`, `low`, `unknown`, `high-z`                                      | `out`                                                             |
| `clock`              | —                                                                       | `out`                                                             |
| `flipflop`           | `sr-latch`, `d-latch`, `d`, `jk`, `t`                                   | `q`, `nq`, `preset`; entradas propias de cada variante (abajo)    |
| `mux`                | `mux`, `demux`                                                          | puertos de datos indexados, `select`, `enable`                    |
| `encoder`, `decoder` | —                                                                       | entradas/salidas indexadas                                        |
| `register`           | —                                                                       | `in`, `in2…`, `out`, `out2…`, `clock`, `enable`, `clear`; `width` |
| `counter`            | —                                                                       | salida indexada, `clock`, `enable`, `clear`                       |
| `adder`              | `half`, `full`                                                          | entradas/salidas indexadas                                        |
| `comparator`         | —                                                                       | `in1`, `in2`, `gt`, `eq`, `lt`                                    |
| `bus`                | `tap`, `splitter`, `joiner`                                             | `bus`, `tap` o ramificaciones indexadas; `width=2..256`           |

Cada terminal de un bloque digital tiene su propia posición. Las entradas de datos se sitúan a la izquierda y las salidas a la derecha. Clock, enable y select se sitúan debajo, preset y clear encima, y cada uno tiene una patilla dibujada. Todos los bloques excepto `buffer`, `logic` y `clock` aceptan [`fit=wires`](/docs/1.3/fit), que alinea sus terminales izquierdos y derechos con sus cables. Un biestable solo acepta las letras de su propia variante:

| Variante   | Entradas | Debajo   | Encima            |
| ---------- | -------- | -------- | ----------------- |
| `d`        | `d`      | `clock`  | `preset`, `clear` |
| `t`        | `t`      | `clock`  | `preset`, `clear` |
| `jk`       | `j`, `k` | `clock`  | `preset`          |
| `sr-latch` | `s`, `r` | `enable` | `preset`          |
| `d-latch`  | `d`      | `clock`  | `preset`          |

`j` en un biestable D se rechaza indicando su línea. En 0.8 se dibujaba sobre la primera entrada, encima de `d`.

```schemd bounds="1140x460" title="Batch counter datapath"
port:PULSE "pulses" at (80, 130) #blue
buffer:SH7 "clean" at (280, 130) #cyan [type=schmitt]
counter:CT7 "count" at (500, 150) #amber
port:LIM "limit" at (80, 330) #amber
comparator:CM7 "N = limit" at (760, 250) #purple
port:DONE "batch done" at (1040, 250) #emerald

PULSE.out -> SH7.in1 #blue [digital ortho]
SH7.out1 -> CT7.clock #cyan [digital ortho]
CT7.out1 -> CM7.in1 #amber [digital ortho]
LIM.out -> CM7.in2 #amber [digital ortho]
CM7.eq -> DONE.in #emerald [digital ortho marker-end=arrow]
```

Un comparador publica tres respuestas, `gt`, `eq` y `lt`, mientras que un único booleano ocultaría la dirección. Por tanto, una ruta de datos que necesite saber en qué dirección se ha cruzado un umbral no requiere una segunda puerta. Aquí, la señal de lote sigue a `eq`, por lo que se activa cuando el recuento alcanza el límite.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=04 / Cuántica; title=Puertas con nombre, CNOT de dos líneas, operadores de varias líneas y resultados clásicos; example-title=Controlled phase with readout -->

Los símbolos de un cúbit son `hadamard`, `qgate`, `xgate`, `ygate`, `zgate`, `sgate`, `sdg`, `tgate`, `tdg`, `sx`, `phase`, `rx`, `ry`, `rz` y `ugate`. Utilizan `in` y `out`, y `qgate` acepta filas de detalle `parameter`, `phase` y `matrix`.

| Tipo                                                                | Puertos estables y opciones                                                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cnot`                                                              | línea de control `in1`, `out1`; línea objetivo `in2`, `out2`; se siguen aceptando los alias antiguos `in`, `out`, `control`, `target`; `fit=wires`                 |
| `measure`                                                           | `in`, `out`, `classical`                                                                                                                                           |
| `reset`                                                             | `in`, `out`                                                                                                                                                        |
| `prepare`                                                           | `out`                                                                                                                                                              |
| `control`                                                           | `in`, `out`, `control`; `control=positive`, `negative` o `classical`                                                                                               |
| `swap`, `cz`, `cphase`, `toffoli`, `controlled`, `barrier`, `delay` | `inN`, `outN`, `controlN`, `targetN` indexados; `wires`, `controls`, `targets` acotados; `fit=wires`; el terminal vertical de la línea inferior apunta hacia abajo |
| `classical-bit`                                                     | `in`, `out`                                                                                                                                                        |
| `classical-register`                                                | `in`, `out`, `width=2..256`                                                                                                                                        |

`cnot` siempre tiene exactamente dos líneas continuas de cúbit. Un circuito compuesto debe utilizar los puertos de paso indexados. `control` y `target` acceden a las posiciones de los marcadores, por compatibilidad y para los metadatos de interacción. `initial` y `final` pertenecen a los diagramas de estados y actividades UML y no marcan límites de estados cuánticos. Una línea cuántica comienza con `prepare` y termina con `measure`, o con un `port` del sistema si permanece sin medir.

```schemd bounds="1000x400" title="Controlled phase with readout"
prepare:P0 "|+\rangle" at (80, 120) #blue
prepare:P1 "|1\rangle" at (80, 280) #blue
cphase:CP7 "CP" at (400, 200) #purple [fit=wires]
measure:MX7 "M_x" at (680, 120) #cyan
classical-bit:CB7 "c_0" at (880, 120) #emerald

P0.out -> CP7.in1 #blue [quantum ortho]
P1.out -> CP7.in2 #blue [quantum ortho]
CP7.out1 -> MX7.in #purple [quantum ortho]
MX7.classical -> CB7.in #cyan [classical line marker-end=arrow]
```

Las líneas son indexadas y continuas. `inN` entra, `outN` sale y el operador abarca todas ellas. `measure` es el único lugar donde una línea cuántica se convierte en clásica. Por eso, su puerto `classical` alimenta el bit clásico, mientras que su `out` transportaría el cúbit hacia la siguiente etapa.

`cnot` es el caso de dos líneas de la misma regla y el que más a menudo se escribe incorrectamente. Tiene exactamente dos líneas continuas. El control entra por `in1` y sale sin cambios por `out1`; el objetivo entra por `in2` y sale por `out2`. Los nombres antiguos `control` y `target` siguen resolviéndose a las posiciones de los marcadores. Un circuito compuesto debe seguir utilizando los puertos de paso indexados, porque la lista de conexiones y los metadatos del modo `full` incluyen esos terminales. Las líneas están separadas por 18 unidades salvo que se escriba [`fit=wires`](/docs/1.3/fit), que las sitúa sobre los cúbits, como en el siguiente ejemplo.

```schemd bounds="920x360" title="Fitted CNOT, both qubits set"
prepare:HC "|1\rangle" at (100, 100) #blue
prepare:HT "|1\rangle" at (100, 270) #blue
cnot:CX at (460, 185) #purple [fit=wires]
port:HOC "control out" at (790, 100) #emerald
port:HOT "target out" at (790, 270) #emerald

HC.out -> CX.in1 #blue [quantum ortho]
HT.out -> CX.in2 #blue [quantum ortho]
CX.out1 -> HOC.in #purple [quantum ortho]
CX.out2 -> HOT.in #purple [quantum ortho marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=uml; eyebrow=05 / UML; title=Nodos estructurales, de despliegue, actividad, estado e interacción; example-title=Documentation deploy interaction -->

El catálogo UML tiene tres grupos.

- Los tipos estructurales son `class`, `interface`, `provided-interface`, `required-interface`, `enumeration`, `datatype`, `object`, `component`, `component-port`, `artifact`, `node`, `device`, `execution`, `system`, `package` y `note`.
- Los tipos de comportamiento son `actor`, `usecase`, `state`, `action`, `decision`, `merge`, `fork`, `join`, `activity-final`, `flow-final`, `object-node`, `send-signal`, `receive-signal` y `partition`.
- Los tipos de interacción y estado son `lifeline`, `activation`, `destruction`, `fragment`, `interaction`, `gate`, `found`, `lost`, `choice`, `state-junction`, `history`, `entry`, `exit`, `terminate`, `region`, `initial` y `final`.

Los nodos rectangulares dimensionables aceptan `width` y `height` acotados. Los nodos similares a clases también aceptan `stereotype`, `attributes` y `operations`. Sus puertos son `left`, `right`, `top` y `bottom`.

Las relaciones son `association`, `dependency`, `generalization`, `realization`, `aggregation`, `composition`, `message`, `synchronous`, `asynchronous`, `return`, `control-flow`, `object-flow`, `assembly`, `delegation`, `transition`, `include` y `extend`.

```schemd bounds="1000x540" title="Documentation deploy interaction"
lifeline:CI7 "CI runner" at (220, 270) #cyan [width=170 height=400]
lifeline:PG7 "Pages host" at (620, 270) #amber [width=170 height=400]
artifact:ST7 "site/" at (880, 420) #emerald [width=170 height=80]

CI7.right90 -> PG7.left90 #cyan [line synchronous label="deploy(1.3.0)"]
PG7.left180 -> CI7.right180 #amber [line return dashed label="200 OK"]
CI7.right270 -> PG7.left270 #cyan [line asynchronous label="invalidate cache"]
ST7.left -> PG7.right350 #emerald [ortho dependency label="build output"]
```

Una línea de vida expone `leftNN` y `rightNN`, que colocan un puerto exactamente `NN` unidades por debajo de su borde superior. Así se sitúan tres mensajes a tres alturas exactas sin que un motor de distribución lo decida, y así la salida de compilación se encuentra con la aplicación a 350 unidades.

<!-- /schemd-section -->

<!-- schemd-section: id=schema; eyebrow=06 / Datos; title=Lea la misma información como datos -->

Todas las tablas de esta página también pueden leerse del compilador. Desde 1.3, `@schemd/core/schema` exporta `SCHEMATIC_COMPONENT_SCHEMAS`, que proporciona la familia y las opciones de cada tipo. Cada opción incluye un tipo de datos, que indica lo que acepta:

| Tipo                | Qué especifica                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `enum`              | los valores aceptados y el valor predeterminado                                                              |
| `integer`, `number` | el intervalo, el valor predeterminado y cualquier valor predeterminado que dependa del `type` del componente |
| `text`              | el valor más corto y el más largo                                                                            |
| `pins`              | el máximo de pines por lado, el patrón que debe cumplir un nombre de pin y los nombres que no puede tomar    |
| `rows`              | el máximo de filas y la longitud máxima de una fila                                                          |

Un tipo que necesita una de varias opciones las enumera en `requiresOneOf`, como hace un circuito integrado con sus cuatro lados. Un par que no puede aparecer conjuntamente se enumera en `conflicts`, como `fit` y `orientation`.

Los puertos dependen de las opciones, por lo que nunca se enumeran a mano. `describeComponentPorts(kind, options)` consulta al analizador los terminales que tiene un componente con esas opciones, y una opción incorrecta lanza el mismo `SchematicSyntaxError` que produciría un documento.

```ts
import { describeComponentPorts } from '@schemd/core/schema';

describeComponentPorts('switch', { type: 'spdt' });
// ['common', 'normally-open', 'normally-closed']
```

El esquema no es una segunda fuente de verdad que pueda desactualizarse. Una prueba del compilador consulta al analizador para cada tipo y opción: cada valor declarado debe compilarse, cada valor justo fuera de un límite declarado debe fallar, cada opción no declarada debe fallar y cada valor predeterminado declarado debe dibujar exactamente lo mismo que si se omite la opción. Las [fichas técnicas de componentes](/components) de este sitio se generan a partir de los mismos datos.

<!-- /schemd-section -->
