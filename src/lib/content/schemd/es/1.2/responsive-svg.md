<!-- schemd-doc: id=responsive-svg; label=SVG adaptable; title=Escale geometría exacta sin desplazar el contenido; summary=Reserve la relación de aspecto, conserve el viewBox y mantenga estables los puertos y las etiquetas de componentes rotados.; category=Crear diagramas; order=50 -->

<!-- schemd-section: id=intrinsic-sizing; eyebrow=01 / Disposición; title=Reserve el lienzo antes de que llegue el SVG; example-title=Responsive RL section -->

El compilador emite `width`, `height` y `viewBox` explícitos, por lo que una página puede reservar el espacio exacto que ocupará el dibujo antes de que llegue. Al contenedor se le asigna el mismo `aspect-ratio`. Así, nada se desplaza. Como los límites del diagrama se conocen antes de analizarlo, la página conoce su tamaño antes de leer un solo trazado; ahí es donde resultan útiles esos límites.

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

```schemd bounds="840x380" title="Responsive RL section"
source:SRC4 "AC" at (80, 120) #blue [type=voltage-ac]
resistor:RS4 "R" at (280, 120) #amber
junction:JN4 at (460, 120) #cyan
inductor:LS4 "L" at (460, 240) #purple [orientation=down]
port:VO4 "out" at (720, 120) #emerald

SRC4.positive -> RS4.in #blue [ortho]
RS4.out -> JN4.node #amber [ortho]
JN4.node -> LS4.in #purple [ortho]
JN4.node -> VO4.in #emerald [ortho]
```

Las etiquetas se emiten fuera del grupo de vectores rotado. Por tanto, el texto permanece horizontal con cualquier tamaño de área visible, y las zonas interactivas de los puertos del modo `full` siguen alineadas con sus terminales. El escalado cambia el tamaño. El contenido permanece fijo.

<!-- /schemd-section -->

<!-- schemd-section: id=containment; eyebrow=02 / Rendimiento; title=Contenga el repintado costoso del contenedor; example-title=Compact alarm circuit -->

Una galería larga se beneficia de `content-visibility: auto`, con `contain-intrinsic-size` como reserva de espacio. Nunca debe animarse una cadena `d` de SVG para mover un panel; debe transformarse el contenedor o cambiar su opacidad. Animar el trazado obliga a recalcular la geometría en cada fotograma para un movimiento que nunca perteneció a esa geometría.

```schemd bounds="700x280" title="Compact alarm circuit"
logic:HI4 "1" at (90, 120) #purple [type=high]
buffer:BF4 "drive" at (330, 120) #cyan [type=schmitt]
load:BZ4 "buzzer" at (590, 120) #emerald [type=buzzer]

HI4.out -> BF4.in1 #purple [digital line]
BF4.out1 -> BZ4.in #emerald [line]
```

<!-- /schemd-section -->
