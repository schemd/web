<!-- schemd-doc: id=component-reference; label=API de componentes; title=Use cada primitiva de la versión 1.2 con criterio; summary=Todas las familias, variantes, opciones, puertos semánticos y orientaciones canónicas.; category=Crear diagramas; order=40 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Una referencia muestra cada primitiva por separado; conectar todos los ejemplos ocultaría el símbolo que presentan. -->

Todas las familias que tienen dirección usan `orientation=right` de forma predeterminada. Un nodo cuyo aspecto es idéntico en todas las direcciones, como `junction`, rechaza esa opción. Los alias siguen siendo válidos, pero los nombres de estas tablas son los que emite el compilador. Cada alias se sustituye por su terminal canónico antes de que lo vea cualquier operación posterior; por ello, el entorno debe usar estos nombres como claves. Todos los tipos admiten declaraciones sin etiqueta; en ese caso, el componente muestra solo su identificador.

<!-- schemd-section: id=electrical; eyebrow=01 / Electricidad; title=Fuentes, conectividad, conmutación e instrumentos; example-title=Metered lamp circuit -->

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

```schemd bounds="1040x420" title="Metered lamp circuit"
connector:J6 "mains" at (90, 150) #slate
protection:CB6 "breaker" at (270, 150) #amber [type=breaker]
switch:S6 "run" at (460, 150) #cyan [type=spst]
meter:A6 "A" at (660, 150) #purple [type=ammeter]
load:L6 "lamp" at (860, 150) #emerald [type=lamp]
testpoint:TP6 at (460, 310) #cyan

J6.out -> CB6.in #slate [line]
CB6.out -> S6.in #amber [line]
S6.out -> A6.in #cyan [line]
A6.out -> L6.in #emerald [line marker-end=arrow]
S6.out -> TP6.node #cyan [ortho]
```

Un relé reúne dos circuitos en un símbolo. `in` y `out` conducen la corriente de la carga, mientras que `coil1` y `coil2` conducen la señal de control que cierra el circuito. Por eso, un relé no necesita un segundo componente para mostrar qué lo acciona. El interruptor `spst` de arriba representa el caso más sencillo: un circuito que se abre y se cierra a mano. Su punto de prueba no lleva etiqueta porque el identificador ya lo nombra.

<!-- /schemd-section -->

<!-- schemd-section: id=passives-semiconductors; eyebrow=02 / Electricidad; title=Componentes pasivos y variantes de semiconductores; example-title=Five more variants -->

Los componentes pasivos comparten `in` y `out`; los diodos exponen `anode` y `cathode`. Un transistor se controla mediante `base` si es BJT y mediante `gate` si es FET o IGBT. Sus otros terminales son `collector` y `emitter`, o `drain` y `source`.

| Tipo         | Variantes                                                                        |
| ------------ | -------------------------------------------------------------------------------- |
| `resistor`   | `fixed`, `variable`, `rheostat`, `potentiometer`, `thermistor`, `ldr`            |
| `capacitor`  | `fixed`, `variable`, `polarized`                                                 |
| `inductor`   | `fixed`, `coupled`, `transformer`                                                |
| `diode`      | `standard`, `schottky`, `zener`, `led`, `photodiode`, `varactor`, `scr`, `triac` |
| `transistor` | `npn`, `pnp`, `nmos`, `pmos`, `njfet`, `pjfet`, `nigbt`, `pigbt`                 |
| `port`       | `width=1..256` opcional; `in`, `out`                                             |
| `ground`     | `signal`, `earth`, `chassis`; `in`                                               |

```schemd bounds="1040x430" title="Five more variants"
resistor:RP6 "trim" at (100, 150) #amber [type=potentiometer]
capacitor:CP6 "polarized" at (290, 150) #cyan [type=polarized orientation=down]
inductor:LC6 "coupled" at (480, 150) #purple [type=coupled]
diode:DZ6 "Zener" at (670, 150) #blue [type=zener]
transistor:QJ6 "n-JFET" at (860, 150) #emerald [type=njfet orientation=up]
```

Una variante cambia el símbolo, pero nunca el contrato de puertos. Tanto un potenciómetro como una resistencia fija se conectan de `in` a `out`. Por tanto, basta con cambiar una palabra para sustituir uno por otro, sin modificar las conexiones.

<!-- /schemd-section -->

<!-- schemd-section: id=digital; eyebrow=03 / Digital; title=Lógica, bloques secuenciales y buses explícitos; example-title=Overtemperature alarm datapath -->

Las puertas clásicas son `and`, `or`, `not`, `nand`, `nor`, `xor` y `xnor`. Usan los puertos indexados `in1..inN` y `out1..outN`, y admiten `standard=ieee|iec`.

| Tipo                 | Variantes de `type`                                                     | Puertos especiales estables                                       |
| -------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `buffer`             | `plain`, `tristate`, `tristate-inverter`, `schmitt`, `schmitt-inverter` | `in1`, `out1`; el búfer de tres estados añade `enable`            |
| `logic`              | `high`, `low`, `unknown`, `high-z`                                      | `out`                                                             |
| `clock`              | —                                                                       | `out`                                                             |
| `flipflop`           | `sr-latch`, `d-latch`, `d`, `jk`, `t`                                   | `q`, `nq`, `preset`; entradas propias de cada variante (abajo)    |
| `mux`                | `mux`, `demux`                                                          | puertos de datos indexados, `select`, `enable`                    |
| `encoder`, `decoder` | —                                                                       | entradas y salidas indexadas                                      |
| `register`           | —                                                                       | `in`, `in2…`, `out`, `out2…`, `clock`, `enable`, `clear`; `width` |
| `counter`            | —                                                                       | salida indexada, `clock`, `enable`, `clear`                       |
| `adder`              | `half`, `full`                                                          | entradas y salidas indexadas                                      |
| `comparator`         | —                                                                       | `in1`, `in2`, `gt`, `eq`, `lt`                                    |
| `bus`                | `tap`, `splitter`, `joiner`                                             | `bus`, `tap` o ramas indexadas; `width=2..256`                    |

Cada terminal de un bloque digital tiene una posición propia. Las entradas de datos se sitúan a la izquierda y las salidas a la derecha. El reloj, la habilitación y la selección se sitúan debajo; la preselección y el borrado, encima. Cada terminal tiene su propia línea de conexión. Todos los bloques salvo `buffer`, `logic` y `clock` admiten [`fit=wires`](/docs/1.2/fit), que alinea sus terminales izquierdos y derechos con sus cables. Un biestable solo admite las letras de su propia variante:

| Variante   | Entradas | Debajo   | Encima            |
| ---------- | -------- | -------- | ----------------- |
| `d`        | `d`      | `clock`  | `preset`, `clear` |
| `t`        | `t`      | `clock`  | `preset`, `clear` |
| `jk`       | `j`, `k` | `clock`  | `preset`          |
| `sr-latch` | `s`, `r` | `enable` | `preset`          |
| `d-latch`  | `d`      | `clock`  | `preset`          |

Un `j` en un biestable D se rechaza con su número de línea. En la versión 0.8 se dibujaba en la primera entrada, sobre `d`.

```schemd bounds="1140x560" title="Overtemperature alarm datapath"
port:TSN "T_{sense}" at (80, 130) #blue
port:TMX "T_{max}" at (80, 250) #amber
comparator:CT6 "T ? max" at (400, 190) #cyan
junction:HOT "hot" at (650, 190) #cyan
buffer:BS6 "filter" at (860, 190) #purple [type=schmitt]
flipflop:LD6 "latch" at (650, 420) #emerald [type=d]
clock:CK6 "CLK" at (200, 420) #amber
port:ALM "alarm" at (1050, 190) #emerald

TSN.out -> CT6.in1 #blue [digital ortho]
TMX.out -> CT6.in2 #amber [digital ortho]
CT6.gt -> HOT.node #cyan [digital ortho]
HOT.node -> BS6.in1 #cyan [digital ortho]
HOT.node -> LD6.d #cyan [digital ortho]
CK6.out -> LD6.clock #amber [digital ortho]
BS6.out1 -> ALM.in #emerald [digital ortho marker-end=arrow]
```

Un comparador ofrece tres resultados, `gt`, `eq` y `lt`; un único valor booleano ocultaría la dirección. Por ello, una ruta de datos que necesita saber en qué sentido se ha cruzado un umbral no requiere otra puerta. Aquí, la alarma sigue a `gt`, por lo que solo se activa por encima del límite.

<!-- /schemd-section -->

<!-- schemd-section: id=quantum; eyebrow=04 / Cuántica; title=Puertas con nombre, CNOT de dos líneas, operadores de varias líneas y resultados clásicos; example-title=Toffoli with classical readout -->

Los símbolos de un solo cúbit son `hadamard`, `qgate`, `xgate`, `ygate`, `zgate`, `sgate`, `sdg`, `tgate`, `tdg`, `sx`, `phase`, `rx`, `ry`, `rz` y `ugate`. Usan `in` y `out`; `qgate` admite filas de detalle `parameter`, `phase` y `matrix`.

| Tipo                                                                | Puertos estables y opciones                                                                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cnot`                                                              | línea de control `in1`, `out1`; línea objetivo `in2`, `out2`; siguen siendo válidos los alias antiguos `in`, `out`, `control`, `target`; `fit=wires`                |
| `measure`                                                           | `in`, `out`, `classical`                                                                                                                                            |
| `reset`                                                             | `in`, `out`                                                                                                                                                         |
| `prepare`                                                           | `out`                                                                                                                                                               |
| `control`                                                           | `in`, `out`, `control`; `control=positive`, `negative` o `classical`                                                                                                |
| `swap`, `cz`, `cphase`, `toffoli`, `controlled`, `barrier`, `delay` | `inN`, `outN`, `controlN`, `targetN` indexados; `wires`, `controls`, `targets` limitados; `fit=wires`; el terminal vertical de la línea inferior apunta hacia abajo |
| `classical-bit`                                                     | `in`, `out`                                                                                                                                                         |
| `classical-register`                                                | `in`, `out`, `width=2..256`                                                                                                                                         |

`cnot` siempre tiene exactamente dos líneas continuas de cúbits. Un circuito compuesto debe usar los puertos de paso indexados. `control` y `target` señalan las posiciones de los marcadores, por compatibilidad y para los metadatos de interacción. `initial` y `final` pertenecen a los diagramas de estados y actividades de UML; no marcan los límites de un estado cuántico. Una línea cuántica comienza con `prepare` y termina con `measure`, o con un `port` de sistema cuando queda sin medir.

```schemd bounds="1000x520" title="Toffoli with classical readout"
prepare:T0 "|1\rangle" at (80, 110) #blue
prepare:T1 "|1\rangle" at (80, 250) #blue
prepare:T2 "|0\rangle" at (80, 390) #blue
toffoli:CCX6 "CCX" at (420, 250) #purple [fit=wires]
measure:MT6 "M_z" at (700, 390) #cyan
classical-bit:CT6B "c_2" at (880, 390) #emerald

T0.out -> CCX6.in1 #blue [quantum ortho]
T1.out -> CCX6.in2 #blue [quantum ortho]
T2.out -> CCX6.in3 #blue [quantum ortho]
CCX6.out3 -> MT6.in #purple [quantum ortho]
MT6.classical -> CT6B.in #cyan [classical line marker-end=arrow]
```

Las líneas son indexadas y continuas. `inN` es la entrada, `outN` es la salida y el operador abarca todas ellas. `measure` es el único punto donde una línea cuántica pasa a ser clásica. Por eso, su puerto `classical` alimenta el bit clásico, mientras que su `out` transportaría el cúbit hacia el resto del circuito.

`cnot` es el caso de dos líneas de esa misma regla, y el que se escribe incorrectamente con más frecuencia. Tiene exactamente dos líneas continuas. El control entra por `in1` y sale sin cambios por `out1`; el objetivo entra por `in2` y sale por `out2`. Los nombres antiguos `control` y `target` siguen resolviéndose como las posiciones de los marcadores. Aun así, un circuito compuesto debe usar los puertos de paso indexados, porque la lista de conexiones y los metadatos del modo `full` incluyen esos terminales. Las líneas están separadas 18 unidades salvo que se escriba [`fit=wires`](/docs/1.2/fit); con esa opción se sitúan sobre los cúbits, como se muestra abajo.

```schemd bounds="900x340" title="Fitted CNOT, Bell pair"
prepare:GC "|+\rangle" at (90, 110) #blue
prepare:GT "|0\rangle" at (90, 250) #blue
cnot:CX at (440, 180) #purple [fit=wires]
port:GOC "control" at (770, 110) #emerald
port:GOT "target" at (770, 250) #emerald

GC.out -> CX.in1 #blue [quantum ortho]
GT.out -> CX.in2 #blue [quantum ortho]
CX.out1 -> GOC.in #purple [quantum ortho]
CX.out2 -> GOT.in #purple [quantum ortho marker-end=arrow]
```

<!-- /schemd-section -->

<!-- schemd-section: id=uml; eyebrow=05 / UML; title=Nodos estructurales, de despliegue, de actividad, de estado y de interacción; example-title=Package publication interaction -->

El catálogo de UML tiene tres grupos.

- Los tipos estructurales son `class`, `interface`, `provided-interface`, `required-interface`, `enumeration`, `datatype`, `object`, `component`, `component-port`, `artifact`, `node`, `device`, `execution`, `system`, `package` y `note`.
- Los tipos de comportamiento son `actor`, `usecase`, `state`, `action`, `decision`, `merge`, `fork`, `join`, `activity-final`, `flow-final`, `object-node`, `send-signal`, `receive-signal` y `partition`.
- Los tipos de interacción y estado son `lifeline`, `activation`, `destruction`, `fragment`, `interaction`, `gate`, `found`, `lost`, `choice`, `state-junction`, `history`, `entry`, `exit`, `terminate`, `region`, `initial` y `final`.

Los nodos rectangulares de tamaño configurable admiten `width` y `height` con límites. Los nodos de tipo clase también admiten `stereotype`, `attributes` y `operations`. Sus puertos son `left`, `right`, `top` y `bottom`.

Las relaciones son `association`, `dependency`, `generalization`, `realization`, `aggregation`, `composition`, `message`, `synchronous`, `asynchronous`, `return`, `control-flow`, `object-flow`, `assembly`, `delegation`, `transition`, `include` y `extend`.

```schemd bounds="1000x540" title="Package publication interaction"
lifeline:RJ6 "Release job" at (220, 270) #cyan [width=170 height=400]
lifeline:NPM6 "npm registry" at (620, 270) #amber [width=170 height=400]
artifact:PKG6 "dist/" at (880, 420) #emerald [width=170 height=80]

RJ6.right90 -> NPM6.left90 #cyan [line synchronous label="publish(1.2.0)"]
NPM6.left180 -> RJ6.right180 #amber [line return dashed label="201 Created"]
RJ6.right270 -> NPM6.left270 #cyan [line asynchronous label="attest provenance"]
PKG6.left -> NPM6.right350 #emerald [ortho dependency label="tarball"]
```

Una línea de vida expone `leftNN` y `rightNN`, que sitúan un puerto exactamente `NN` unidades por debajo de su borde superior. Así se colocan tres mensajes a tres alturas exactas sin que un motor de disposición decida por nosotros, y así llega la dependencia del archivo tar al registro a una altura de 350 unidades.

<!-- /schemd-section -->
