<!-- schemd-doc: id=subcircuits; label=Subcircuitos; title=Escriba un bloque una vez y colóquelo varias veces; summary=Defina subcircuitos reutilizables con parámetros y terminales expuestos, anídelos y conozca exactamente las declaraciones en las que se expanden.; category=Crear diagramas; order=27 -->

<!-- schemd-section: id=blocks; eyebrow=01 / Bloques; title=Defina un bloque y coloque copias; example-title=Two LC stages; example-summary=Una definición colocada dos veces con valores distintos y conectada mediante los terminales que expone. -->

Los esquemas reales contienen repeticiones. Un filtro tiene dos etapas idénticas y una placa puede llevar cuatro redes de desacoplamiento idénticas. Si cada copia se escribe a mano, una corrección puede aplicarse a una copia y omitirse en las demás.

Un subcircuito es un bloque que se escribe una vez:

```text
subcircuit NAME [parameters] {
  …ordinary declarations…
  expose TERMINAL = PART.port
}
```

Después se coloca por su nombre tantas veces como sea necesario:

```text
NAME:ID at (x, y) [name=value]
```

Dentro de las llaves se utiliza el mismo lenguaje que en cualquier otra parte: componentes, conexiones, colocación relativa y comentarios. Las coordenadas escritas con `at (x, y)` son relativas al origen del propio bloque, y la posición de la instancia desplaza todo el bloque. Una instancia no tiene etiqueta ni color propios, porque representa una colocación y no un componente.

```schemd bounds="900x540" title="Two LC stages"
subcircuit lc [l="10 \mu H" c="100 nF"] {
  inductor:L "{{l}}" at (0, 0) #purple
  junction:N right-of L by 50 #cyan
  capacitor:C "{{c}}" below N by 50 aligned-x with N #cyan [orientation=down]
  L.out -> N.node #purple [ortho]
  N.node -> C.in #cyan [ortho]
  expose in = L.in
  expose out = N.node
  expose gnd = C.out
}

source:SW "V_{sw}" at (90, 160) #blue [type=voltage-pulse]
lc:F1 at (260, 160)
lc:F2 at (540, 160) [l="4.7 \mu H" c="47 nF"]
port:VF "V_{f}" at (820, 160) #emerald
ground:GND "0 V" at (420, 450) #slate

SW.positive -> F1.in #blue [ortho]
F1.out -> F2.in #cyan [ortho]
F2.out -> VF.in #emerald [ortho]
SW.negative -> GND.in #slate [ortho]
F1.gnd -> GND.in #slate [ortho]
F2.gnd -> GND.in #slate [ortho]
```

Fuera del bloque, nunca se accede directamente a `L` y `C`. El cable llega a `F1.out`, un terminal que la definición decidió exponer, y el compilador lo resuelve al terminal interno que indica. Así, el interior de un bloque puede reorganizarse sin modificar ninguna de las conexiones que lo utilizan. La unión `N` no lleva etiqueta, por lo que cada copia muestra solo su designador, `F1_N` o `F2_N`.

<!-- /schemd-section -->

<!-- schemd-section: id=parameters; eyebrow=02 / Parámetros; title=Varíe cada copia mediante parámetros; example-title=Fused lamp bank; example-summary=Un bloque de fusible y lámpara, tres colores y tres corrientes nominales de fusible. -->

El encabezado de un bloque declara los parámetros que puede establecer una instancia. Cada parámetro tiene un valor predeterminado, como `fuse="1 A"`, o se declara sin valor. Un parámetro sin valor es obligatorio: todas las instancias deben establecerlo; de lo contrario, la compilación falla e identifica la instancia y el parámetro.

Dentro del bloque, `{{name}}` se sustituye por el valor de la instancia en cualquier parte de una línea, ya sea en una etiqueta, un color o una opción. Las llaves dobles son deliberadas, de modo que una etiqueta matemática como `V_{out}` nunca se confunda con un parámetro.

```text
load:L "{{name}}" right-of F by 70 #{{tone}} [type=lamp]
```

Los valores siguen las reglas de las opciones de conexión. `tone=amber` no necesita comillas; cualquier valor que contenga un espacio sí las necesita. Un parámetro desconocido produce un error de compilación en la línea que lo causó. Lo mismo ocurre si un parámetro se establece dos veces o si se usa un `{{placeholder}}` que el encabezado nunca declaró.

```schemd bounds="760x500" title="Fused lamp bank"
subcircuit lamp [name tone fuse="1 A"] {
  protection:F "{{fuse}}" at (0, 0) #amber [type=fuse]
  load:L "{{name}}" right-of F by 70 #{{tone}} [type=lamp]
  F.out -> L.in #{{tone}} [ortho]
  expose a = F.in
  expose k = L.out
}

port:V12 "12 V" at (90, 100) #blue
lamp:K1 at (260, 100) [name=cabin tone=amber fuse="2 A"]
lamp:K2 at (260, 220) [name=deck tone=cyan]
lamp:K3 at (260, 340) [name=warning tone=rose fuse="500 mA"]
ground:GND "0 V" at (660, 420) #slate

V12.out -> K1.a #blue [ortho]
V12.out -> K2.a #blue [ortho]
V12.out -> K3.a #blue [ortho]
K1.k -> GND.in #slate [ortho]
K2.k -> GND.in #slate [ortho]
K3.k -> GND.in #slate [ortho]
```

Los tres fusibles son distintos porque las tres lámparas consumen corrientes diferentes. Este es el tipo de diferencia que debe expresar un parámetro: la estructura es compartida y los valores varían.

<!-- /schemd-section -->

<!-- schemd-section: id=nesting; eyebrow=03 / Anidamiento; title=Construya bloques a partir de otros bloques; example-title=Two-pole LC filter from nested stages; example-summary=Un bloque de dos polos formado por dos bloques de un polo, a los que se pasan directamente los parámetros. -->

Un bloque puede colocar otros bloques, por lo que un filtro LC de dos polos puede escribirse como dos etapas de un polo en lugar de cuatro componentes. Los parámetros se transmiten mediante marcadores. `lc:A at (0, 0) [l="{{l}}" c="{{c1}}"]` pasa los valores de la instancia exterior a la interior. Un terminal expuesto también puede indicar un terminal de una instancia anidada, y el compilador sigue la referencia a través de todos los niveles.

```schemd bounds="960x540" title="Two-pole LC filter from nested stages"
subcircuit lc [l c] {
  inductor:L "{{l}}" at (0, 0) #purple
  junction:N right-of L by 50 #cyan
  capacitor:C "{{c}}" below N by 50 aligned-x with N #cyan [orientation=down]
  L.out -> N.node #purple [ortho]
  N.node -> C.in #cyan [ortho]
  expose in = L.in
  expose out = N.node
  expose gnd = C.out
}

subcircuit pair [c1 c2 l="22 \mu H"] {
  lc:A at (0, 0) [l="{{l}}" c="{{c1}}"]
  lc:B at (290, 0) [l="{{l}}" c="{{c2}}"]
  A.out -> B.in #cyan [ortho]
  expose in = A.in
  expose out = B.out
  expose ga = A.gnd
  expose gb = B.gnd
}

source:PWM "V_{pwm}" at (90, 160) #blue [type=voltage-pulse]
pair:F at (250, 160) [c1="220 nF" c2="22 nF"]
port:VDC "V_{dc}" at (870, 160) #emerald
ground:GND "0 V" at (400, 450) #slate

PWM.positive -> F.in #blue [ortho]
F.out -> VDC.in #emerald [ortho]
PWM.negative -> GND.in #slate [ortho]
F.ga -> GND.in #slate [ortho]
F.gb -> GND.in #slate [ortho]
```

Se rechaza un bloque que se contiene a sí mismo, directamente o mediante una cadena de otros bloques, y el diagnóstico indica la cadena: `Subcircuit a contains itself through a -> b -> a`.

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=04 / Expansión; title=Conozca exactamente en qué se convierte un bloque; example-title=Strap pull-downs; example-summary=Dos copias de un bloque de resistencia a tierra, que se expanden en componentes llamados PD_RST_R y PD_BOOT_R. -->

Un subcircuito no es un nuevo tipo de objeto. Al igual que la [colocación relativa](/docs/1.3/placement), se convierte en declaraciones que el compilador ya entiende antes de que cualquier otra operación lea el documento. Por tanto, todas las pasadas posteriores ven un documento plano ordinario, desde la validación y el trazado hasta la lista de conexiones, el renderizador y el mapa de origen. Conviene conocer con precisión las reglas de expansión, porque determinan lo que aparece en la salida.

- Cada ID interno recibe como prefijo el ID de la instancia y el carácter `_`. `PD_RST` coloca `R` como `PD_RST_R`, y una instancia anidada añade un nivel, como en `F_A_L`. Estos son los ID que llevan la lista de conexiones, el atributo `data-node-id` del SVG y los designadores.
- Las posiciones se desplazan. Un `at (x, y)` interno se desplaza según la posición de la instancia, y una relación interna apunta a los ID con prefijo.
- Las líneas se conservan. Una declaración copiada conserva la línea de la definición que la escribió. Un diagnóstico sobre una declaración del cuerpo apunta a esa declaración, y el mapa de origen remite cada copia de `R` a la única línea que la declara.
- Un bloque solo puede acceder a sus propios componentes. Todos los ID dentro de las llaves reciben un prefijo, por lo que una referencia al exterior del bloque nombra un componente que no existe. Los bloques no pueden depender de su entorno sin declararlo.
- La expansión tiene un presupuesto. Las declaraciones expandidas cuentan para el mismo límite de [`sourceCharacters`](/docs/1.3/limits) que el código fuente. Una instancia es una abreviatura de los componentes que representa y, sin un límite, tres niveles de ocho instancias convertirían catorce líneas en 512 componentes.
- Un bloque que nunca se coloca produce un error. Lo mismo ocurre con un bloque que ocultaría un tipo integrado, una definición duplicada, un bloque sin cerrar, `expose` fuera de un bloque y un ID compartido por una instancia y un componente.

```schemd bounds="780x520" title="Strap pull-downs"
subcircuit pulldown {
  resistor:R "100 k\Omega" at (0, 0) #amber [orientation=down]
  expose line = R.in
  expose rail = R.out
}

port:RSTN "RESET" at (90, 110) #cyan
port:BOOT "BOOT" at (90, 210) #violet
port:MCU_R "to MCU" at (680, 110) #cyan
port:MCU_B "to MCU" at (680, 210) #violet
pulldown:PD_RST at (330, 300)
pulldown:PD_BOOT at (480, 300)
ground:GND "0 V" at (400, 450) #slate

RSTN.out -> MCU_R.in #cyan [ortho]
BOOT.out -> MCU_B.in #violet [ortho]
PD_RST.line -> MCU_R.in #cyan [ortho]
PD_BOOT.line -> MCU_B.in #violet [ortho]
PD_RST.rail -> GND.in #slate [ortho]
PD_BOOT.rail -> GND.in #slate [ortho]
```

[`parseSchematicSvg`](/docs/1.3/reading-back) recupera un subcircuito compilado como sus componentes aplanados. El SVG no registra qué componentes proceden de cada bloque y el descompilador no lo deduce.

<!-- /schemd-section -->
