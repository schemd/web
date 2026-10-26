<!-- schemd-doc: id=integrations; label=Interacción; title=Delegue la interacción desde una única raíz SVG; summary=Use los atributos de datos semánticos del modo full sin regenerar el esquema con cada cambio de estado.; category=Publicar resultados; order=70 -->

<!-- schemd-section: id=delegation; eyebrow=01 / Eventos; title=Registre un único controlador de eventos y modifique las clases de estado; example-title=Probe-ready digital path -->

El diagrama se compila una vez en modo `full` y después se delega la interacción. Un único controlador de eventos en el entorno resuelve `event.target.closest('[data-node-id], [data-wire-source], [data-port-id]')`; esa es toda la capa de interacción. Una simulación activa o desactiva clases o propiedades personalizadas en los elementos que encuentra. No se vuelve a compilar nada. El estado de la aplicación reside fuera del SVG, y recompilar el mismo código fuente es determinista, por lo que el dibujo puede tratarse como un recurso reemplazable.

```schemd bounds="860x340" title="Probe-ready digital path"
port:REQ2 "REQ" at (80, 130) #blue
clock:MCK at (80, 270) #amber
nor:ARB3 "NOR" at (350, 130) #cyan [inputs=2]
testpoint:TPC at (590, 130) #purple
port:IDLE at (790, 130) #emerald

REQ2.out -> ARB3.in1 #blue [digital ortho]
MCK.out -> ARB3.in2 #amber [digital ortho]
ARB3.out1 -> TPC.node #cyan [digital ortho]
TPC.node -> IDLE.in #emerald [digital ortho]
```

La correspondencia entre el código fuente y el vector usa las propias líneas del compilador, que comienzan en uno. No hace falta otro analizador. La respuesta ya incluye el mapa de código fuente de referencia; un segundo analizador daría una segunda respuesta que, tarde o temprano, sería distinta.

<!-- /schemd-section -->

<!-- schemd-section: id=accessibility; eyebrow=02 / Accesibilidad; title=Mantenga equivalentes las acciones del puntero y del teclado; example-title=Accessible measurement path -->

Los nodos y los puertos llevan etiquetas estables en el SVG generado, pero eso solo cubre lo que emitió el compilador. El entorno debe garantizar una accesibilidad equivalente para todo lo que añada alrededor. Eso implica botones semánticos, estados `aria-pressed` y `aria-expanded` fieles al estado real, foco visible y activación por teclado para cada acción disponible mediante el puntero.

```schemd bounds="760x320" title="Accessible measurement path"
prepare:QN "|0\rangle" at (80, 130) #blue
sgate:SN at (300, 130) #cyan
qgate:PN "P" at (520, 130) #purple [parameter="\pi/8"]
measure:MN "M_y" at (700, 130) #emerald

QN.out -> SN.in #blue [quantum line]
SN.out -> PN.in #cyan [quantum line]
PN.out -> MN.in #purple [quantum line]
```

Un componente declarado sin etiqueta conserva un nombre accesible completo en modo `full`, como `SN, sgate`, sin ningún campo vacío.

<!-- /schemd-section -->
