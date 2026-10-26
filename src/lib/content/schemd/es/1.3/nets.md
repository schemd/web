<!-- schemd-doc: id=nets; label=Redes y uniones; title=Trace redes completas; summary=Cómo decide el compilador por dónde pasan los cables: cada red forma un árbol, las uniones están donde se colocan y el contacto en la página siempre significa contacto en el circuito.; category=Crear diagramas; order=22 -->

<!-- schemd-section: id=trees; eyebrow=01 / Árboles; title=Una red es un árbol; example-title=One branch off a resistor; example-summary=La salida de RX llega a DX y CX: una red, un árbol y un punto. -->

Las conexiones que comparten un terminal pertenecen a una misma red y el compilador traza la red en su conjunto. La primera conexión va de un terminal a otro. Cada conexión posterior parte del tramo de conductor más cercano que ya tiene la red, y en el punto de partida se dibuja un punto de unión. Una red nunca se dibuja como dos cables superpuestos y dos cables de una misma red nunca forman una T sin un punto.

El código fuente no especifica dónde va cada ramificación. El orden de crecimiento se determina a partir de la posición de los terminales y nunca del orden de las líneas, de modo que reorganizar un documento no puede cambiar su dibujo.

```schemd bounds="660x380" title="One branch off a resistor"
source:VD "3.3 V" at (110, 210) #blue [type=voltage-dc orientation=up]
resistor:RX "470 \Omega" at (300, 120) #amber
diode:DX "status" at (510, 120) #rose [type=led]
capacitor:CX "1 \mu F" at (410, 250) #cyan [orientation=down]

VD.positive -> RX.in #blue [ortho]
RX.out -> DX.anode #amber [ortho]
RX.out -> CX.in #amber [ortho]
```

`trunk` se sigue aceptando y registrando como `connection.trunk`, por lo que las fuentes de 0.8 siguen compilándose. El dibujo ya no depende de esta opción y una red sin ella se dibuja como el mismo árbol.

<!-- /schemd-section -->

<!-- schemd-section: id=junctions; eyebrow=02 / Uniones; title=Coloque la unión donde corresponda; example-title=A labelled node with three branches; example-summary=Todos los cables declarados hacia ND llegan directamente a él. -->

Cuando una ramificación debe situarse en un lugar concreto, se coloca allí un `junction`. Los cables declarados hacia su `node` llegan directamente desde cualquier lado, y su propio punto representa la unión, por lo que no aparece otro punto a su lado. Su designador y su etiqueta se sitúan arriba y a la derecha del punto, sin obstaculizar ninguna de las cuatro salidas. Así, un cable nunca tiene que evitar el nombre de la propia unión. Desde 1.2, la etiqueta puede omitirse y la unión muestra solo su designador.

```schemd bounds="720x420" title="A labelled node with three branches"
diode:DD "D_r" at (190, 180) #rose
junction:ND "V_{d}" at (370, 180) #rose
port:VDO "out" at (560, 180) #emerald
resistor:RD "R_d" at (370, 310) #amber [orientation=down]

DD.cathode -> ND.node #rose [ortho]
ND.node -> VDO.in #rose [ortho]
ND.node -> RD.in #rose [ortho]
```

Una unión tiene cuatro lados. Declarar un quinto cable hacia ella no es un error: se conecta al conductor de la red junto a la unión, con su propio punto. Si un cable anterior de la red ya pasa directamente por el punto de la unión, esta ya forma parte del árbol antes de que se declare ninguna conexión hacia ella. Una conexión posterior se dibuja sobre ese conductor y no añade trazos. Antes de 1.0.2, una conexión de este tipo podía dibujar un pequeño bucle junto al punto. En 1.0, conectar dos veces los mismos extremos de unión en una red de este tipo podía provocar un `TypeError` en el compilador; ahora esa repetición se dibuja sobre el conductor como cualquier otra.

Un componente colocado con relación a una unión queda exactamente donde quedaba antes. La colocación se mide a partir de las filas de texto centradas de la unión, y el texto dibujado junto al punto no lo desplaza.

<!-- /schemd-section -->

<!-- schemd-section: id=contact; eyebrow=03 / Contacto; title=El contacto en la página es contacto en el circuito; example-title=Chip select across a bus pair; example-summary=Una red lleva puntos donde se cruza consigo misma; otra la cruza mediante puentes. -->

Las redes distintas nunca se tocan. Cuando el tramo vertical de un cable ortogonal cruza otra red, el tramo vertical lleva un pequeño puente y los tramos horizontales permanecen rectos. Junto a un cable vecino, el arco se reduce a la mitad de la separación para no invadirlo. La patilla de un pin cuenta como contacto en toda su longitud. Ningún cable la cruza junto al pin y ningún cable pasa por un terminal que no tiene conexiones.

Los cables de una misma red que se cruzan forman un nodo, y ese cruce se marca con un punto. El resultado del trazado enumera esos puntos como `joins`, junto al `junction` que una ramificación indica en el lugar donde se separa del conductor de su red.

```schemd bounds="780x490" title="Chip select across a bus pair"
port:MOSI "MOSI" at (100, 180) #cyan
port:MOSIO "MOSI'" at (660, 180) #cyan
port:MISO "MISO" at (100, 310) #cyan
port:MISOO "MISO'" at (660, 310) #cyan
port:PRB "probe" at (290, 80) #cyan [orientation=down]
port:PRBO "probe'" at (290, 410) #cyan [orientation=up]
port:CSN "CS" at (470, 80) #amber [orientation=down]
port:CSNO "CS'" at (470, 410) #amber [orientation=up]

MOSI.out -> MOSIO.in #cyan [ortho net=SPI]
MISO.out -> MISOO.in #cyan [ortho net=SPI]
PRB.out -> PRBO.out #cyan [ortho net=SPI]
CSN.out -> CSNO.out #amber [ortho net=CS]
```

La línea de la sonda pertenece a la red del bus, por lo que sus dos cruces llevan puntos. La línea vecina de selección de chip pertenece a una red propia y cruza ambas líneas del bus mediante puentes.

Un cable recto o Bézier no puede rodear obstáculos. Si se dibujara a través del terminal de otro componente, parecería una conexión que no existe, por lo que se rechaza y el diagnóstico indica que se utilice un recorrido ortogonal o se mueva el componente.

<!-- /schemd-section -->

<!-- schemd-section: id=negotiation; eyebrow=04 / Negociación; title=Los conflictos se negocian con enteros; example-title=Around the transformer; example-summary=La línea de alimentación rodea el transformador por su lado libre, sin tocar la línea de datos. -->

Cada red se traza una vez sobre una retícula formada por líneas separadas según el paso de canal y por las coordenadas relevantes: bordes de obstáculos, pines y puntos de salida de los cables. El orden procede de la geometría. En esta primera pasada se prohíbe el contacto entre redes y la mayoría de los documentos se resuelven en ella.

Una red que no puede colocarse así se coloca con un coste y el trazador negocia. Las redes en contacto se retiran y se trazan de nuevo, aumentando el coste y añadiendo un coste histórico a cada lugar disputado anteriormente. Todos los costes son enteros y todas las coordenadas son enteros en milésimas de unidad, por lo que el resultado es exacto e idéntico en todos los motores. `routing.attempts` cuenta las rondas de negociación y `routing.rippedUp` cuenta los cables retirados durante ellas. `routingAttempts: 1` prohíbe por completo el contacto.

```schemd bounds="780x380" title="Around the transformer"
port:LP "L_{in}" at (90, 160) #rose
component:TFM "transformer" at (390, 160) #slate [width=170 height=100]
port:LQ "L_{out}" at (690, 160) #rose
port:DP "DATA" at (90, 300) #blue
port:DQ "DATA'" at (690, 300) #blue

LP.out -> LQ.in #rose [ortho]
DP.out -> DQ.in #blue [ortho]
```

Cuando un documento no puede trazarse, el error identifica el cable que no pudo colocarse e indica qué cambiar. Las soluciones habituales son separar dos componentes, ampliar los límites del bloque o unir las pistas que se encuentran mediante una red compartida. Dos redes cuyas patillas se tocan se notifican como contacto, que es un error distinto de un fallo de trazado. Si una patilla entra en otro componente o en un terminal que no tiene conexiones, se identifican ambos componentes.

<!-- /schemd-section -->
