<!-- schemd-doc: id=integrations; label=Interacción; title=Delegue la interacción desde una raíz SVG; summary=Use los datos semánticos del modo full sin regenerar el esquema con cada cambio de estado.; category=Publicar resultados; order=70 -->

<!-- schemd-section: id=delegation; eyebrow=01 / Eventos; title=Registre un manejador y modifique las clases de estado; example-title=A digital path ready for probing -->

El diagrama se compila una vez en modo `full` y después se delega la interacción. Un manejador en el contenedor resuelve `event.target.closest('[data-node-id], [data-wire-source], [data-port-id]')`. La simulación modifica clases o propiedades personalizadas en el elemento encontrado. El estado de la aplicación se conserva fuera del SVG. La recompilación del mismo código es determinista, por lo que el dibujo puede sustituirse cuando sea necesario.

```schemd bounds="860x340" title="A digital path ready for probing"
port:GNT "GNT" at (80, 130) #blue
clock:BCK at (80, 270) #amber
and:ARB4 "AND" at (350, 130) #cyan [inputs=2]
testpoint:TPD at (590, 130) #purple
port:VALID at (790, 130) #emerald

GNT.out -> ARB4.in1 #blue [digital ortho]
BCK.out -> ARB4.in2 #amber [digital ortho]
ARB4.out1 -> TPD.node #cyan [digital ortho]
TPD.node -> VALID.in #emerald [digital ortho]
```

La correspondencia entre el código fuente y los vectores usa las líneas del propio compilador, numeradas desde uno. La respuesta ya contiene el mapa de origen de referencia. Un segundo analizador produciría una segunda interpretación que podría discrepar.

<!-- /schemd-section -->

<!-- schemd-section: id=accessibility; eyebrow=02 / Accesibilidad; title=Haga equivalentes el puntero y el teclado; example-title=A measurement path with full names -->

Los nodos y terminales incluyen nombres estables en el SVG generado. La aplicación anfitriona debe proporcionar la misma accesibilidad a los controles que añada. Esto requiere botones semánticos, estados `aria-pressed` y `aria-expanded` que correspondan a la interfaz, foco visible y activación mediante teclado para todas las acciones disponibles con el puntero.

```schemd bounds="760x320" title="A measurement path with full names"
prepare:QT "|+\rangle" at (80, 130) #blue
tgate:TT at (300, 130) #cyan
qgate:PT "P" at (520, 130) #purple [parameter="\pi/4"]
measure:MT "M_x" at (700, 130) #emerald

QT.out -> TT.in #blue [quantum line]
TT.out -> PT.in #cyan [quantum line]
PT.out -> MT.in #purple [quantum line]
```

Un componente declarado sin etiqueta conserva un nombre accesible completo en modo `full`, por ejemplo `TT, tgate`, sin campos vacíos.

<!-- /schemd-section -->
