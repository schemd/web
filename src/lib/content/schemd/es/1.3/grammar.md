<!-- schemd-doc: id=grammar; label=Gramática; title=Utilice la gramática estricta de 1.3; summary=Coloque nodos tipados, gire la geometría canónica y conecte puertos semánticos validados.; category=Crear diagramas; order=20 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Los fragmentos de gramática muestran una declaración cada vez. -->

<!-- schemd-section: id=declarations; eyebrow=01 / Nodos; title=Declare un componente con límites definidos por línea; example-title=Vertical Zener reference; example-summary=La orientación gira la geometría y los nombres de los puertos se mantienen. -->

Cada componente se declara en una línea:

```text
kind:ID "label" at (x, y) #color [options]
```

Los identificadores distinguen entre mayúsculas y minúsculas, y cada uno se convierte en una clave del mapa de origen. Una opción desconocida, repetida o ajena al tipo produce un error de compilación con un número de línea que empieza en uno.

Desde 1.2 puede omitirse la etiqueta entre comillas. `junction:JZ at (380, 360) #cyan` es una declaración completa y el componente dibuja solo su designador. Un par de comillas vacío sigue siendo un error, porque una etiqueta que no dice nada debe omitirse.

`orientation` acepta exactamente `right`, `down`, `left` o `up`. Un componente que no cambia con ninguna rotación, como un `junction`, la rechaza. La rotación mueve la geometría como una sola pieza: el cuerpo, sus puertos, sus normales exteriores, el rectángulo de colisión y los corredores de trazado. El vocabulario nunca gira. Un diodo vertical sigue conectándose de `anode` a `cathode` y una fuente vertical sigue teniendo `positive` y `negative`. Por tanto, girar un símbolo nunca reescribe las conexiones que lo rodean.

```schemd bounds="800x720" title="Vertical Zener reference"
source:VS "9 V" at (380, 90) #blue [type=voltage-dc orientation=down]
resistor:RZ "1 k\Omega" at (380, 240) #amber [orientation=down]
junction:JZ at (380, 360) #cyan
diode:DZ "5.1 V" at (380, 490) #rose [type=zener orientation=up]
port:REF "V_{ref}" at (660, 360) #emerald
ground:GZ at (380, 640) #slate

VS.positive -> RZ.in #blue [ortho]
RZ.out -> JZ.node #amber [ortho]
JZ.node -> DZ.cathode #rose [ortho]
JZ.node -> REF.in #emerald [ortho marker-end=arrow]
DZ.anode -> GZ.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=connections; eyebrow=02 / Cables; title=Conecte puertos semánticos y dominios de señal; example-title=Four-lane reversal bus; example-summary=Cada línea debe cruzar todas las demás; cada red se traza una vez, en un orden determinado por la geometría. -->

Una conexión consiste en dos terminales unidos por una flecha:

```text
A.port -> B.port #color [options]
```

Un recorrido es `line`, `bezier` u `ortho`. Los dominios de señal son `electrical`, `digital`, `quantum` y `classical`. Una discrepancia de ancho se rechaza antes de la distribución, por lo que nunca se dibuja como un error aparentemente válido.

`net=NAME` da una identidad a un grupo de segmentos. Los segmentos que comparten un `component.port` exacto se unen automáticamente, de modo que todas las ramificaciones de un `junction.node` forman una red. Un nombre también puede unir segmentos que nunca se tocan. Todos los segmentos de una red deben coincidir en dominio y ancho, y dos nombres distintos en un terminal compartido son un error. Una red sin nombre sigue recibiendo una identidad estable, `$1`, `$2` y así sucesivamente en el orden del código fuente, y aparece en el AST, el mapa de origen y el `data-net-id` del SVG en modo `full`.

El contacto en la página siempre significa contacto en el circuito. Las redes distintas nunca se tocan: donde se cruzan dos, el tramo vertical lleva un puente. Los cables de una misma red que se cruzan forman un nodo y reciben un punto. Los cuerpos pueden encontrarse en un borde, pero nunca solaparse. Un cable `line` o `bezier` que pasa por el terminal de otro componente se rechaza, porque parecería una conexión. La página de [redes y uniones](/docs/1.3/nets) explica cada regla.

Un bus de inversión es la prueba más difícil para el trazador, porque cada línea tiene que cruzar todas las demás:

```schemd bounds="880x570" title="Four-lane reversal bus"
port:W0 "W_0" at (100, 110) #rose [width=1]
port:W1 "W_1" at (100, 230) #blue [width=1]
port:W2 "W_2" at (100, 350) #amber [width=1]
port:W3 "W_3" at (100, 470) #emerald [width=1]
port:Z0 "Z_0" at (780, 470) #rose [width=1]
port:Z1 "Z_1" at (780, 350) #blue [width=1]
port:Z2 "Z_2" at (780, 230) #amber [width=1]
port:Z3 "Z_3" at (780, 110) #emerald [width=1]

W0.out -> Z0.in #rose [ortho digital net=R0]
W1.out -> Z1.in #blue [ortho digital net=R1]
W2.out -> Z2.in #amber [ortho digital net=R2]
W3.out -> Z3.in #emerald [ortho digital net=R3]
```

Cada red se busca una vez sobre una retícula de líneas separadas según el paso de canal y las coordenadas relevantes. El orden de la búsqueda procede de la posición de los terminales y nunca del orden de declaración, y en esa pasada se prohíbe el contacto entre redes. Una red que aún no puede colocarse se coloca con un coste. Las redes que toca se retiran y se trazan de nuevo, aumentando el coste y añadiendo un coste histórico a cada lugar disputado anteriormente. Todos los costes son enteros, por lo que el resultado es el mismo en todos los motores JavaScript.

`compileSchematic` informa del trabajo del trazador en `routing`. `attempts` cuenta las rondas de negociación, `rippedUp` cuenta los cables retirados durante ellas y `congestion` proporciona la carga de cada celda de la retícula. Un bus de doce cables con conflictos se traza en la primera pasada en unos 1.5 ms. `routing.nudged` siempre es `false`, porque el desplazamiento de grupos de 0.7 ya no existe. El [inspector](/inspector/1.3.0) dibuja el informe completo.

<!-- /schemd-section -->

<!-- schemd-section: id=options; eyebrow=03 / Validación; title=Utilice opciones de familia, siempre tipadas; example-title=Named-pin motor driver; example-summary=Cada nombre de pin se convierte en un puerto accesible que distingue entre mayúsculas y minúsculas. -->

Las opciones se comprueban por nombre frente al tipo al que pertenecen. Las comunes son `type`, `orientation`, `inputs`, `outputs`, `width`, `controls`, `targets`, `wires`, `parameter`, `phase`, `matrix`, `operator`, `control` y [`fit`](/docs/1.3/fit). La [API de componentes](/docs/1.3/component-reference) enumera qué opciones acepta cada tipo. No existe un conjunto de atributos sin tipar. Por tanto, una opción mal escrita produce un error de compilación y nunca un dibujo silenciosamente incorrecto.

`ic` lo muestra con claridad. Sus listas `left`, `right`, `top` y `bottom` entre comillas se convierten en puertos que distinguen mayúsculas y minúsculas, y el cuerpo crece para alojar el lado más largo, por lo que nunca se dimensiona la caja a mano:

```schemd bounds="960x540" title="Named-pin motor driver"
port:PWM1 "PWM_A" at (90, 130) #blue
port:PWM2 "PWM_B" at (90, 250) #blue
port:NSLP "awake" at (90, 370) #amber
ic:U5 "DRV" at (450, 250) #cyan [left="IN1,IN2,nSLEEP" right="OUT1,OUT2" bottom="GND"]
load:MOT "motor" at (790, 250) #emerald [type=motor orientation=down]
ground:DG "0 V" at (450, 460) #slate

PWM1.out -> U5.IN1 #blue [ortho]
PWM2.out -> U5.IN2 #blue [ortho]
NSLP.out -> U5.nSLEEP #amber [ortho]
U5.OUT1 -> MOT.in #emerald [ortho]
U5.OUT2 -> MOT.out #emerald [ortho]
U5.GND -> DG.in #slate [ortho]
```

Todos los cables de este ejemplo indican un pin real, desde `U5.IN1` hasta `U5.GND`. Los genéricos `in` y `out` siguen resolviéndose a la primera entrada y salida adecuadas cuando la elección no importa. En un encapsulado con pines nombrados suele importar.

<!-- /schemd-section -->

<!-- schemd-section: id=trunks; eyebrow=04 / Árboles; title=Cada red con varios terminales es un árbol; example-title=Lamps on one rail; example-summary=Tres lámparas y un zumbador comparten una alimentación y un retorno, con cada red dibujada como un árbol sin ninguna opción. -->

Una red que alcanza varios terminales sigue escribiéndose como una conexión por terminal y se dibuja como un árbol sin solicitarlo. La primera conexión va de un terminal a otro. Cada conexión posterior parte del conductor más cercano que ya tiene la red, con un punto donde se une. La geometría determina dónde se une cada ramificación, por lo que reordenar las líneas no cambia nada.

```schemd bounds="940x520" title="Lamps on one rail"
port:V24 "24 V" at (90, 110) #blue
load:L1 "run" at (300, 260) #emerald [type=lamp orientation=down]
load:L2 "stop" at (470, 260) #emerald [type=lamp orientation=down]
load:L3 "fault" at (640, 260) #emerald [type=lamp orientation=down]
load:B4 "alarm" at (810, 260) #emerald [type=buzzer orientation=down]
ground:COM "0 V" at (120, 440) #slate

V24.out -> L1.in #blue [ortho]
V24.out -> L2.in #blue [ortho]
V24.out -> L3.in #blue [ortho]
V24.out -> B4.in #blue [ortho]
L1.out -> COM.in #slate [ortho]
L2.out -> COM.in #slate [ortho]
L3.out -> COM.in #slate [ortho]
B4.out -> COM.in #slate [ortho]
```

`trunk` sigue analizándose, validándose y registrándose como `connection.trunk`, por lo que un documento de 0.8 sigue compilándose. El dibujo ya no depende de esta opción y una red sin ella se dibuja como el mismo árbol. Si una ramificación debe estar en un lugar concreto, debe colocarse allí un `junction`, y los cables declarados hacia él [se encuentran en él](/docs/1.3/nets#junctions). Una conexión cuyo extremo de unión lleva un marcador conserva su recorrido completo de terminal a terminal, por lo que una punta de flecha nunca termina en una unión.

<!-- /schemd-section -->
