<!-- schemd-doc: id=responsive-svg; label=SVG adaptable; title=Escale la geometría exacta sin desplazar el contenido; summary=Reserve la relación de aspecto, conserve el viewBox y mantenga estables las etiquetas y los terminales girados.; category=Crear diagramas; order=50 -->

<!-- schemd-section: id=intrinsic-sizing; eyebrow=01 / Distribución; title=Reserve el lienzo antes de recibir el SVG; example-title=Responsive RC high-pass -->

El compilador emite `width`, `height` y `viewBox` explícitos. Por ello, una página puede reservar el espacio exacto del dibujo antes de recibirlo. El contenedor recibe la misma propiedad `aspect-ratio` y el contenido conserva su posición. Los límites se declaran antes del análisis, así que la página conoce el tamaño del diagrama antes de leer el primer trazado.

```css
.schemd-frame {
	aspect-ratio: 840 / 380;
	contain: layout paint;
}
.schemd-frame > svg {
	display: block;
	inline-size: 100%;
	block-size: auto;
}
```

```schemd bounds="840x380" title="Responsive RC high-pass"
source:SRC5 "AC" at (80, 120) #blue [type=voltage-ac]
capacitor:CS5 "C" at (280, 120) #cyan
junction:JN5 at (460, 120) #cyan
resistor:RS5 "R" at (460, 240) #amber [orientation=down]
port:VO5 "out" at (720, 120) #emerald

SRC5.positive -> CS5.in #blue [ortho]
CS5.out -> JN5.node #cyan [ortho]
JN5.node -> RS5.in #amber [ortho]
JN5.node -> VO5.in #emerald [ortho]
```

Las etiquetas se emiten fuera del grupo vectorial girado. El texto permanece derecho con cualquier tamaño de ventana y las zonas interactivas de los terminales en modo `full` siguen alineadas con ellos. La escala modifica el tamaño y conserva el contenido.

<!-- /schemd-section -->

<!-- schemd-section: id=containment; eyebrow=02 / Rendimiento; title=Limite el trabajo de repintado del contenedor; example-title=Compact tone circuit -->

Una galería larga puede usar `content-visibility: auto` con `contain-intrinsic-size` como reserva de espacio. Para mover un panel, transforme su contenedor o modifique su opacidad. Animar una cadena SVG `d` obliga a recalcular geometría en cada fotograma aunque el movimiento corresponda al panel.

```schemd bounds="700x280" title="Compact tone circuit"
logic:LO5 "0" at (90, 120) #purple [type=low]
buffer:IV5 "invert" at (330, 120) #cyan [type=schmitt-inverter]
load:SP5 "speaker" at (590, 120) #emerald [type=speaker]

LO5.out -> IV5.in1 #purple [digital line]
IV5.out1 -> SP5.in #emerald [line]
```

<!-- /schemd-section -->
