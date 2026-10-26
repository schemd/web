<!-- schemd-doc: id=subcircuits; label=Subcircuitos; title=Escriba un bloque una vez y colóquelo muchas veces; summary=Defina subcircuitos reutilizables con parámetros y terminales expuestos, anídelos y conozca exactamente en qué declaraciones se convierten.; category=Crear diagramas; order=27 -->

<!-- schemd-section: id=blocks; eyebrow=01 / Bloques; title=Defina un bloque y coloque copias de él; example-title=Two high-pass stages; example-summary=Una definición colocada dos veces con valores distintos y conectada mediante los terminales que expone. -->

Los esquemas reales contienen repeticiones. Un filtro tiene dos etapas idénticas, y una placa puede incluir cuatro redes de desacoplo iguales. Cuando cada copia se escribe a mano, es habitual que una corrección llegue a una copia y no a las demás.

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

Dentro de las llaves se usa el mismo lenguaje que en el resto del documento: componentes, conexiones, colocación relativa y comentarios. Las coordenadas escritas con `at (x, y)` son relativas al origen del propio bloque, y la posición de la instancia desplaza el bloque entero. Una instancia no tiene etiqueta ni color propios, porque es una colocación, no un componente.

```schemd bounds="900x540" title="Two high-pass stages"
subcircuit hp [c="100 nF" r="10 k\Omega"] {
  capacitor:C "{{c}}" at (0, 0) #cyan
  junction:N right-of C by 50 #cyan
  resistor:R "{{r}}" below N by 50 aligned-x with N #amber [orientation=down]
  C.out -> N.node #cyan [ortho]
  N.node -> R.in #amber [ortho]
  expose in = C.in
  expose out = N.node
  expose gnd = R.out
}

source:MIC "V_{mic}" at (90, 160) #blue [type=voltage-ac]
hp:H1 at (260, 160)
hp:H2 at (540, 160) [c="47 nF" r="22 k\Omega"]
port:VHP "V_{hp}" at (820, 160) #emerald
ground:GND "0 V" at (420, 450) #slate

MIC.positive -> H1.in #blue [ortho]
H1.out -> H2.in #cyan [ortho]
H2.out -> VHP.in #emerald [ortho]
MIC.negative -> GND.in #slate [ortho]
H1.gnd -> GND.in #slate [ortho]
H2.gnd -> GND.in #slate [ortho]
```

Fuera del bloque nunca se hace referencia directa a `C` y `R`. El cable se dirige a `H1.out`, un terminal que la definición decidió exponer, y el compilador lo resuelve como el terminal interno que nombra. Por tanto, se puede reorganizar el interior de un bloque sin modificar ninguna conexión que lo use. La unión `N` no lleva etiqueta, por lo que cada copia muestra solo su identificador, `H1_N` o `H2_N`.

<!-- /schemd-section -->

<!-- schemd-section: id=parameters; eyebrow=02 / Parámetros; title=Varíe cada copia mediante parámetros; example-title=Status LED bank; example-summary=Un bloque de LED y resistencia, tres colores y tres valores de limitación de corriente. -->

La cabecera de un bloque declara los parámetros que puede establecer una instancia. Cada parámetro tiene un valor predeterminado, como `r="330 \Omega"`, o se declara sin valor. Un parámetro sin valor es obligatorio: todas las instancias deben establecerlo; en caso contrario, la compilación falla e identifica la instancia y el parámetro.

Dentro del bloque, `{{name}}` se sustituye por el valor de la instancia en cualquier parte de una línea, ya sea una etiqueta, un color o una opción. Las llaves dobles son deliberadas, para que una etiqueta matemática como `V_{out}` nunca se confunda con un parámetro.

```text
diode:D "{{name}}" right-of R by 70 #{{tone}} [type=led]
```

Los valores siguen las reglas de las opciones de conexión. `tone=amber` no necesita comillas; cualquier valor que contenga un espacio sí las necesita. Un parámetro desconocido produce un error de compilación en la línea que lo causó. Lo mismo ocurre con un parámetro establecido dos veces o con un `{{placeholder}}` que la cabecera nunca declaró.

```schemd bounds="760x500" title="Status LED bank"
subcircuit led [name tone r="330 \Omega"] {
  resistor:R "{{r}}" at (0, 0) #amber
  diode:D "{{name}}" right-of R by 70 #{{tone}} [type=led]
  R.out -> D.anode #{{tone}} [ortho]
  expose a = R.in
  expose k = D.cathode
}

port:V3 "3.3 V" at (90, 100) #blue
led:S1 at (260, 100) [name=power tone=emerald r="150 \Omega"]
led:S2 at (260, 220) [name=link tone=cyan r="100 \Omega"]
led:S3 at (260, 340) [name=error tone=rose]
ground:GND "0 V" at (660, 420) #slate

V3.out -> S1.a #blue [ortho]
V3.out -> S2.a #blue [ortho]
V3.out -> S3.a #blue [ortho]
S1.k -> GND.in #slate [ortho]
S2.k -> GND.in #slate [ortho]
S3.k -> GND.in #slate [ortho]
```

Las tres resistencias limitadoras de corriente tienen valores distintos porque las tensiones directas de los LED son distintas. Ese es precisamente el tipo de diferencia que debe expresar un parámetro: la estructura es común y los valores varían.

<!-- /schemd-section -->

<!-- schemd-section: id=nesting; eyebrow=03 / Anidamiento; title=Construya bloques a partir de otros bloques; example-title=Two-pole high-pass from nested stages; example-summary=Un bloque de dos polos formado por dos bloques de un polo, con parámetros que se transmiten directamente. -->

Un bloque puede colocar otros bloques, de modo que un filtro paso alto de dos polos se puede escribir como dos etapas de un polo en lugar de cuatro componentes. Los parámetros se transmiten mediante marcadores. `hp:A at (0, 0) [c="{{c}}" r="{{r1}}"]` entrega los valores de la instancia exterior a la interior. Un terminal expuesto también puede nombrar un terminal de una instancia anidada, y el compilador lo sigue a través de todos los niveles.

```schemd bounds="960x540" title="Two-pole high-pass from nested stages"
subcircuit hp [c r] {
  capacitor:C "{{c}}" at (0, 0) #cyan
  junction:N right-of C by 50 #cyan
  resistor:R "{{r}}" below N by 50 aligned-x with N #amber [orientation=down]
  C.out -> N.node #cyan [ortho]
  N.node -> R.in #amber [ortho]
  expose in = C.in
  expose out = N.node
  expose gnd = R.out
}

subcircuit pair [r1 r2 c="10 nF"] {
  hp:A at (0, 0) [c="{{c}}" r="{{r1}}"]
  hp:B at (290, 0) [c="{{c}}" r="{{r2}}"]
  A.out -> B.in #cyan [ortho]
  expose in = A.in
  expose out = B.out
  expose ga = A.gnd
  expose gb = B.gnd
}

source:PU "V_{pickup}" at (90, 160) #blue [type=voltage-ac]
pair:F at (250, 160) [r1="15 k\Omega" r2="150 k\Omega"]
port:VCR "V_{cr}" at (870, 160) #emerald
ground:GND "0 V" at (400, 450) #slate

PU.positive -> F.in #blue [ortho]
F.out -> VCR.in #emerald [ortho]
PU.negative -> GND.in #slate [ortho]
F.ga -> GND.in #slate [ortho]
F.gb -> GND.in #slate [ortho]
```

Un bloque que se contiene a sí mismo, directamente o a través de una cadena de otros bloques, se rechaza; el diagnóstico identifica la cadena: `Subcircuit a contains itself through a -> b -> a`.

<!-- /schemd-section -->

<!-- schemd-section: id=lowering; eyebrow=04 / Expansión; title=Conozca exactamente en qué se convierte un bloque; example-title=Chip-select pull-ups; example-summary=Dos copias de un bloque de polarización pull-up que se convierten en componentes llamados PU_CS0_R y PU_CS1_R. -->

Un subcircuito no es un tipo de objeto nuevo. Al igual que la [colocación relativa](/docs/1.2/placement), se convierte en declaraciones que el compilador ya entiende antes de que cualquier otra operación lea el documento. Por eso, todas las pasadas posteriores ven un documento plano ordinario, desde la validación y el trazado hasta la lista de conexiones, el renderizador y el mapa de código fuente. Conviene conocer con precisión las reglas de expansión porque son las que aparecen en la salida.

- A cada ID interno se le anteponen el ID de la instancia y el carácter `_`. `PU_CS0` coloca `R` como `PU_CS0_R`; una instancia anidada añade un nivel, como en `F_A_R`. Esos son los ID que aparecen en la lista de conexiones, en el `data-node-id` del SVG y en los identificadores visibles.
- Las posiciones se desplazan. Un `at (x, y)` interno se mueve según la posición de la instancia, y una relación interna pasa a apuntar a los ID con prefijo.
- Las líneas se conservan. Una declaración copiada mantiene la línea de la definición que la escribió. Un diagnóstico sobre una declaración del cuerpo apunta a esa declaración, y el mapa de código fuente vincula cada copia de `R` con la única línea que la declara.
- Un bloque solo alcanza sus propios componentes. Todos los ID dentro de las llaves reciben un prefijo; por eso, una referencia hacia fuera del bloque nombra un componente que no existe. Los bloques no pueden depender de su entorno sin indicarlo.
- La expansión tiene límites de recursos. Las declaraciones expandidas cuentan para el mismo límite [`sourceCharacters`](/docs/1.2/limits) que el código fuente. Una instancia abrevia los componentes que representa y, sin un máximo, tres niveles de ocho instancias convertirían catorce líneas en 512 componentes.
- Un bloque que nunca se coloca produce un error. Lo mismo ocurre con un bloque que ocultaría un tipo incorporado, una definición duplicada, un bloque sin cerrar, `expose` fuera de un bloque o un ID compartido por una instancia y un componente.

```schemd bounds="760x500" title="Chip-select pull-ups"
subcircuit pullup {
  resistor:R "10 k\Omega" at (0, 0) #amber [orientation=up]
  expose rail = R.out
  expose line = R.in
}

port:VIO "V_{io}" at (90, 90) #blue
pullup:PU_CS0 at (330, 200)
pullup:PU_CS1 at (480, 200)
port:CS0 "CS_0" at (90, 320) #cyan
port:CS1 "CS_1" at (90, 420) #violet
port:FLASH "flash" at (680, 320) #cyan
port:SENSOR "sensor" at (680, 420) #violet

VIO.out -> PU_CS0.rail #blue [ortho]
VIO.out -> PU_CS1.rail #blue [ortho]
CS0.out -> FLASH.in #cyan [ortho]
CS1.out -> SENSOR.in #violet [ortho]
PU_CS0.line -> FLASH.in #cyan [ortho]
PU_CS1.line -> SENSOR.in #violet [ortho]
```

[`parseSchematicSvg`](/docs/1.2/reading-back) recupera un subcircuito compilado como sus componentes aplanados. Nada en el SVG registra qué componentes proceden de qué bloque, y el descompilador no lo supone.

<!-- /schemd-section -->
