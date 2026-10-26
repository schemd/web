<!-- schemd-doc: id=nets; label=Redes y uniones; title=Trace redes, no cables individuales; summary=Cómo decide el compilador por dónde van los cables: cada red es un árbol, las uniones están donde se colocan y el contacto en la página siempre significa contacto en el circuito.; category=Crear diagramas; order=22 -->

<!-- schemd-section: id=trees; eyebrow=01 / Árboles; title=Una red es un árbol; example-title=Shared tap; example-summary=La salida de RA llega a LB y CB: una red, un árbol y un punto. -->

Las conexiones que comparten un terminal pertenecen a una misma red, y el compilador traza esa red en conjunto. La primera conexión va de terminal a terminal. Cada una de las siguientes parte del conductor existente más cercano de la red; el punto del que parte recibe un punto de unión. Una red nunca se dibuja como dos cables superpuestos, y dos cables de una misma red nunca forman una T sin un punto.

Nada en el código fuente indica por dónde va una rama. El orden de crecimiento depende de la posición de los terminales, nunca del orden de las líneas; por tanto, reordenar un documento no puede cambiar su dibujo.

```schemd bounds="660x380" title="Shared tap"
source:VS "5 V" at (110, 210) #blue [type=voltage-dc orientation=up]
resistor:RA "1 k\Omega" at (300, 120) #amber
inductor:LB "10 \mu H" at (510, 120) #purple
capacitor:CB "47 nF" at (410, 250) #cyan [orientation=down]

VS.positive -> RA.in #blue [ortho]
RA.out -> LB.in #amber [ortho]
RA.out -> CB.in #amber [ortho]
```

`trunk` sigue siendo válido y se registra como `connection.trunk`, por lo que los documentos de la versión 0.8 siguen compilándose. El dibujo ya no depende de esa opción, y una red sin ella se dibuja como el mismo árbol.

<!-- /schemd-section -->

<!-- schemd-section: id=junctions; eyebrow=02 / Uniones; title=Coloque la unión donde corresponde; example-title=Three branches from one node; example-summary=Todos los cables dirigidos a NS llegan directamente a él. -->

Cuando una rama debe incorporarse en un punto concreto, se coloca allí un `junction`. Los cables dirigidos a su `node` llegan directamente a él desde cualquier lado, y su propio punto representa la unión, por lo que no aparece otro punto a su lado. Su identificador y su etiqueta se sitúan arriba y a la derecha del punto, sin ocupar ninguna de las cuatro salidas. Así, un cable nunca tiene que esquivar el nombre de la propia unión. Desde la versión 1.2 puede omitirse la etiqueta; entonces, la unión muestra solo su identificador.

```schemd bounds="720x400" title="Three branches from one node"
diode:DA "D_a" at (190, 180) #rose
junction:NS "V_{s}" at (370, 180) #rose
resistor:RS "R_s" at (550, 180) #amber
capacitor:CS "C_s" at (370, 300) #cyan [orientation=down]

DA.cathode -> NS.node #rose [ortho]
NS.node -> RS.in #rose [ortho]
NS.node -> CS.in #rose [ortho]
```

Una unión tiene cuatro lados. Un quinto cable dirigido a ella no produce un error: se incorpora al conductor de la red junto a la unión, con su propio punto. Cuando un cable anterior de la red ya atraviesa directamente el punto de la unión, esta pertenece al árbol antes de que se escriba una conexión dirigida a ella. Esa conexión se dibuja entonces sobre el conductor existente y no añade tinta. Antes de la versión 1.0.2, una conexión así podía dibujar un pequeño bucle junto al punto. En la versión 1.0, conectar dos veces los mismos extremos de unión en una red de este tipo podía bloquear el compilador con un `TypeError`; ahora, esa repetición se dibuja sobre el conductor como cualquier otra conexión.

Un componente colocado con relación a una unión queda exactamente donde quedaba antes. La colocación mide desde las filas de texto centradas de la unión, y el texto dibujado junto al punto no la desplaza.

<!-- /schemd-section -->

<!-- schemd-section: id=contact; eyebrow=03 / Contacto; title=El contacto en la página es contacto en el circuito; example-title=Interrupt across a bus pair; example-summary=Una red lleva puntos donde se cruza consigo misma; otra la cruza mediante puentes. -->

Las redes separadas nunca se tocan. Cuando el tramo vertical de un cable ortogonal cruza otra red, ese tramo lleva un pequeño puente y los tramos horizontales permanecen rectos. Junto a un cable vecino, el arco se reduce a la mitad del espacio disponible, por lo que nunca invade al vecino. La patilla de un pin cuenta como contacto en toda su longitud. Ningún cable la cruza junto al pin, y ningún cable atraviesa un terminal al que no haya nada conectado.

Los cables de una misma red que se cruzan forman un nodo, y ese cruce se marca con un punto. El resultado del trazado enumera esos puntos como `joins`, además del `junction` que una rama informa donde se incorpora al conductor de su red.

```schemd bounds="780x490" title="Interrupt across a bus pair"
port:SDA "SDA" at (100, 180) #cyan
port:SDAO "SDA'" at (660, 180) #cyan
port:SCL "SCL" at (100, 310) #cyan
port:SCLO "SCL'" at (660, 310) #cyan
port:PU "pull-up" at (300, 80) #cyan [orientation=down]
port:PUO "pull-up'" at (300, 410) #cyan [orientation=up]
port:IRQ "IRQ" at (480, 80) #amber [orientation=down]
port:IRQO "IRQ'" at (480, 410) #amber [orientation=up]

SDA.out -> SDAO.in #cyan [ortho net=I2C]
SCL.out -> SCLO.in #cyan [ortho net=I2C]
PU.out -> PUO.out #cyan [ortho net=I2C]
IRQ.out -> IRQO.out #amber [ortho net=IRQ]
```

La línea de polarización pull-up pertenece a la red del bus, por lo que sus dos cruces son puntos. La línea de interrupción vecina pertenece a una red propia y cruza ambas líneas del bus mediante puentes.

Un cable recto o Bézier no puede desviarse para rodear obstáculos. Si se dibujara a través del terminal de otro componente, parecería una conexión que no existe; por eso se rechaza, y el diagnóstico indica que se use un trazado ortogonal o se mueva el componente.

<!-- /schemd-section -->

<!-- schemd-section: id=negotiation; eyebrow=04 / Negociación; title=Los conflictos se negocian con enteros; example-title=Around the relay; example-summary=La línea de red eléctrica rodea el relé por su lado libre y evita la línea de medida. -->

Cada red se traza una vez sobre una retícula formada por líneas con la separación de los canales y las coordenadas relevantes: bordes de obstáculos, pines y puntos por los que salen los cables. El orden se deriva de la geometría. El contacto entre redes está prohibido en esa primera pasada, en la que terminan la mayoría de los documentos.

Una red que no pueda colocarse así se coloca asignando un coste, y el trazador negocia. Las redes que se tocan se retiran y se vuelven a trazar, aumentando el coste y añadiendo un coste histórico a cada posición que haya tenido conflictos. Todos los costes son enteros y cada coordenada es un entero en milésimas de unidad, por lo que el resultado es exacto e idéntico en todos los motores. `routing.attempts` cuenta las rondas de negociación y `routing.rippedUp` cuenta los cables retirados durante ellas. `routingAttempts: 1` prohíbe por completo el contacto.

```schemd bounds="780x380" title="Around the relay"
port:MP "AC_{in}" at (90, 160) #rose
component:RLY "relay" at (390, 160) #slate [width=160 height=100]
port:MQ "AC_{out}" at (690, 160) #rose
port:SP "SENSE" at (90, 300) #blue
port:SQ "SENSE'" at (690, 300) #blue

MP.out -> MQ.in #rose [ortho]
SP.out -> SQ.in #blue [ortho]
```

Cuando no es posible trazar un documento, el error identifica el cable que no se pudo colocar e indica qué cambiar. Las soluciones habituales son separar dos componentes, ampliar los límites del bloque o unir mediante una red compartida las pistas que se encuentran. Dos redes cuyas patillas se tocan se notifican como contacto, que es un error distinto de un fallo de trazado. Una patilla que entra en otro componente o en un terminal sin conexiones identifica ambos componentes.

<!-- /schemd-section -->
