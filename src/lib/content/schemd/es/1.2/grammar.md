<!-- schemd-doc: id=grammar; label=Gramática; title=Use la gramática estricta de la versión 1.2; summary=Coloque nodos tipados, rote la geometría canónica y conecte puertos semánticos validados.; category=Crear diagramas; order=20 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Los fragmentos de gramática muestran una declaración a la vez. -->

<!-- schemd-section: id=declarations; eyebrow=01 / Nodos; title=Declare un componente con límites por línea; example-title=Vertical status LED; example-summary=La orientación rota la geometría y los nombres de puerto permanecen iguales. -->

Cada componente se declara en una línea:

```text
kind:ID "label" at (x, y) #color [options]
```

Los identificadores distinguen entre mayúsculas y minúsculas, y cada uno se convierte en una clave del mapa de código fuente. Una opción desconocida, repetida o ajena al tipo produce un error de compilación con un número de línea que comienza en uno.

Desde la versión 1.2 se puede omitir la etiqueta entre comillas. `junction:JA at (380, 360) #cyan` es una declaración completa, y el componente muestra solo su identificador. Un par de comillas vacío sigue siendo un error, porque una etiqueta que no dice nada debe omitirse.

`orientation` admite exactamente `right`, `down`, `left` o `up`. Un componente cuyo aspecto no cambia con ninguna rotación, como `junction`, rechaza la opción. La rotación mueve la geometría como una sola pieza: el cuerpo, sus puertos, sus normales hacia el exterior, el rectángulo de colisión y los corredores de trazado. El vocabulario nunca rota. Un diodo vertical sigue conectándose de `anode` a `cathode`, y una fuente vertical sigue teniendo `positive` y `negative`. Por tanto, rotar un símbolo nunca obliga a reescribir las conexiones que lo rodean.

```schemd bounds="800x720" title="Vertical status LED"
source:VCC "3.3 V" at (380, 90) #blue [type=voltage-dc orientation=down]
resistor:RL "220 \Omega" at (380, 240) #amber [orientation=down]
junction:JA at (380, 360) #cyan
diode:LED "status" at (380, 490) #rose [type=led orientation=down]
port:SNS "to ADC" at (660, 360) #emerald
ground:LG at (380, 640) #slate

VCC.positive -> RL.in #blue [ortho]
RL.out -> JA.node #amber [ortho]
JA.node -> LED.anode #rose [ortho]
JA.node -> SNS.in #emerald [ortho marker-end=arrow]
LED.cathode -> LG.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=connections; eyebrow=02 / Cables; title=Conecte puertos semánticos y dominios de señal; example-title=Six-lane reversal bus; example-summary=Cada línea debe cruzar todas las demás; cada red se traza una vez en un orden derivado de la geometría. -->

Una conexión consiste en dos terminales unidos por una flecha:

```text
A.port -> B.port #color [options]
```

Un trazado es `line`, `bezier` u `ortho`. Los dominios de señal son `electrical`, `digital`, `quantum` y `classical`. Una diferencia de anchura se rechaza antes de la disposición, por lo que nunca se dibuja como un error de apariencia plausible.

`net=NAME` da una identidad común a un grupo de segmentos. Los segmentos que comparten exactamente el mismo `component.port` se unen sin indicación adicional, de modo que todas las ramas de un mismo `junction.node` forman una red. Un nombre también puede unir segmentos que nunca se tocan. Todos los segmentos de una red deben coincidir en dominio y anchura; dos nombres distintos en un terminal compartido producen un error. Una red sin nombre recibe igualmente una identidad estable, `$1`, `$2` y así sucesivamente en orden de aparición; esa identidad figura en el AST, en el mapa de código fuente y en el `data-net-id` del SVG del modo `full`.

El contacto en la página siempre significa contacto en el circuito. Las redes separadas nunca se tocan: donde se cruzan dos, el tramo vertical lleva un puente. Los cables de una misma red que se cruzan forman un nodo y reciben un punto. Los cuerpos pueden encontrarse por un borde, pero nunca solaparse. Un cable `line` o `bezier` que atraviesa el terminal de otro componente se rechaza porque parecería una conexión. La página de [redes y uniones](/docs/1.2/nets) explica cada regla.

Un bus de inversión es la prueba más difícil para el trazador, porque cada línea debe cruzar todas las demás:

```schemd bounds="920x650" title="Six-lane reversal bus"
port:A0 "A_0" at (100, 100) #rose [width=1]
port:A1 "A_1" at (100, 190) #blue [width=1]
port:A2 "A_2" at (100, 280) #amber [width=1]
port:A3 "A_3" at (100, 370) #violet [width=1]
port:A4 "A_4" at (100, 460) #emerald [width=1]
port:A5 "A_5" at (100, 550) #cyan [width=1]
port:B0 "B_0" at (820, 550) #rose [width=1]
port:B1 "B_1" at (820, 460) #blue [width=1]
port:B2 "B_2" at (820, 370) #amber [width=1]
port:B3 "B_3" at (820, 280) #violet [width=1]
port:B4 "B_4" at (820, 190) #emerald [width=1]
port:B5 "B_5" at (820, 100) #cyan [width=1]

A0.out -> B0.in #rose [ortho digital net=L0]
A1.out -> B1.in #blue [ortho digital net=L1]
A2.out -> B2.in #amber [ortho digital net=L2]
A3.out -> B3.in #violet [ortho digital net=L3]
A4.out -> B4.in #emerald [ortho digital net=L4]
A5.out -> B5.in #cyan [ortho digital net=L5]
```

Para cada red se realiza una búsqueda sobre una retícula formada por líneas con la separación de los canales y las coordenadas relevantes. El orden de búsqueda depende de la posición de los terminales, nunca del orden de declaración, y en esa pasada se prohíbe el contacto entre redes. Si una red sigue sin poder colocarse, se coloca asignando un coste. Las redes que toca se retiran y se vuelven a trazar, aumentando ese coste y añadiendo un coste histórico a cada posición que haya tenido conflictos. Todos los costes son enteros, por lo que el resultado es el mismo en todos los motores de JavaScript.

`compileSchematic` informa del trabajo del trazador en `routing`. `attempts` cuenta las rondas de negociación, `rippedUp` cuenta los cables retirados durante ellas y `congestion` indica la carga de cada celda de la retícula. Un bus de doce cables con conflictos se traza en la primera pasada en aproximadamente 1.5 ms. `routing.nudged` siempre es `false`, porque el desplazamiento de haces de la versión 0.7 ya no existe. El [inspector](/inspector/1.2.0) muestra el informe completo.

<!-- /schemd-section -->

<!-- schemd-section: id=options; eyebrow=03 / Validación; title=Use opciones de familia, nunca atributos sin tipo; example-title=Named-pin LDO; example-summary=Cada nombre de pin se convierte en un puerto direccionable que distingue entre mayúsculas y minúsculas. -->

Las opciones se comprueban por nombre frente al tipo al que pertenecen. Las habituales son `type`, `orientation`, `inputs`, `outputs`, `width`, `controls`, `targets`, `wires`, `parameter`, `phase`, `matrix`, `operator`, `control` y [`fit`](/docs/1.2/fit). La [API de componentes](/docs/1.2/component-reference) enumera qué opciones admite cada tipo. No existe un conjunto de atributos sin tipo. Por eso, una opción mal escrita produce un error de compilación y nunca un dibujo silenciosamente incorrecto.

`ic` lo muestra con claridad. Cada elemento de sus listas entre comillas `left`, `right`, `top` y `bottom` se convierte en un puerto que distingue entre mayúsculas y minúsculas; además, el cuerpo crece para alojar el lado más largo, por lo que nunca hay que dimensionar la caja a mano:

```schemd bounds="980x520" title="Named-pin LDO"
port:VBAT "V_{bat}" at (90, 180) #blue
capacitor:CIN "10 \mu F" at (250, 330) #cyan [orientation=down]
ic:U4 "LDO" at (480, 240) #cyan [left="IN,EN" right="OUT,PG" bottom="GND"]
port:RAIL "3.3 V" at (860, 210) #emerald
port:PGOOD "power good" at (860, 320) #amber
ground:LG "0 V" at (480, 440) #slate

VBAT.out -> U4.IN #blue [ortho]
VBAT.out -> U4.EN #blue [ortho]
VBAT.out -> CIN.in #blue [ortho]
CIN.out -> LG.in #slate [ortho]
U4.OUT -> RAIL.in #emerald [ortho marker-end=arrow]
U4.PG -> PGOOD.in #amber [ortho]
U4.GND -> LG.in #slate [ortho]
```

Cada cable de este ejemplo nombra un pin real, desde `U4.IN` hasta `U4.GND`. Los genéricos `in` y `out` siguen resolviéndose como la primera entrada y salida adecuadas cuando la elección no importa. En un encapsulado con pines con nombre, suele importar.

<!-- /schemd-section -->

<!-- schemd-section: id=trunks; eyebrow=04 / Árboles; title=Cada red de varios terminales es un árbol; example-title=Decoupling bank; example-summary=Cuatro condensadores comparten una alimentación y un retorno; cada red se dibuja como un árbol sin necesidad de opciones. -->

Una red que alcanza varios terminales sigue escribiéndose como una conexión por terminal y se dibuja como un árbol sin tener que indicarlo. La primera conexión va de terminal a terminal. Cada una de las siguientes parte del conductor existente más cercano de la red, con un punto donde se une. La geometría determina dónde se incorpora cada rama, por lo que cambiar el orden de las líneas no cambia nada.

```schemd bounds="940x510" title="Decoupling bank"
port:V5 "5 V" at (90, 110) #blue
capacitor:C1 "100 nF" at (300, 250) #cyan [orientation=down]
capacitor:C2 "100 nF" at (470, 250) #cyan [orientation=down]
capacitor:C3 "1 \mu F" at (640, 250) #cyan [orientation=down]
capacitor:C4 "10 \mu F" at (810, 250) #cyan [type=polarized orientation=down]
ground:RET "0 V" at (120, 430) #slate

V5.out -> C1.in #blue [ortho]
V5.out -> C2.in #blue [ortho]
V5.out -> C3.in #blue [ortho]
V5.out -> C4.in #blue [ortho]
C1.out -> RET.in #slate [ortho]
C2.out -> RET.in #slate [ortho]
C3.out -> RET.in #slate [ortho]
C4.out -> RET.in #slate [ortho]
```

`trunk` se sigue analizando, validando y registrando como `connection.trunk`, por lo que los documentos de la versión 0.8 siguen compilándose. El dibujo ya no depende de esa opción y una red sin ella se dibuja como el mismo árbol. Cuando una rama debe incorporarse en un punto concreto, se debe colocar allí un `junction`; los cables dirigidos a él [se unen en ese punto](/docs/1.2/nets#junctions). Una conexión cuyo extremo de unión lleva un marcador conserva su recorrido completo de terminal a terminal, por lo que una punta de flecha nunca termina en una unión.

<!-- /schemd-section -->
