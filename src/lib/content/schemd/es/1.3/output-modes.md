<!-- schemd-doc: id=output-modes; label=Modos de salida; title=Elija el modo SVG que necesita; summary=La salida estática, el CSS de tema integrado y los enlaces semánticos completos comparten la misma geometría.; category=Publicar resultados; order=60 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Estos ejemplos muestran el marcado emitido. -->

<!-- schemd-section: id=modes; eyebrow=01 / Salida; title=Separe la geometría de los datos de interacción; example-title=Same geometry in every mode -->

| Modo           | Añade                                                              | Uso previsto                                               |
| -------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `default`      | Solo SVG estático accesible                                        | Artículos, exportaciones para correo y recursos inmutables |
| `embedded-css` | Clases aisladas de tema y estado                                   | Documentos adaptables con tema                             |
| `full`         | Datos para nodos, terminales, cables, líneas de origen y topología | Correspondencias y simulaciones del editor                 |

Todos los modos comparten el documento analizado, la distribución, las rutas y el viewBox. Solo cambian el estilo y los metadatos. La posición del dibujo se conserva. El SVG sin procesar del editor es la cadena exacta mostrada en la vista de representación; no se reconstruye una instantánea del DOM.

Con los enlaces de cables activos, cada cable de señal incluye su topología resuelta en `data-net-id`. Una red con nombre conserva el elegido por el autor, mientras que una red anónima usa una identidad estable `$N`. El mapa de origen de la compilación expone el mismo valor como `SchematicWireSource.netId`. Los conectores UML que solo expresan una relación omiten ese campo. Cada punto de unión dibujado por el trazador lleva la clase `schematic-junction`. El contenedor puede así distinguir las uniones de los terminales, tanto donde una rama parte de una red como donde un cable cruza su propia red.

Una conexión escrita con `trunk` conserva `data-wire-trunk`, y un componente declarado con `fit=wires` conserva `data-fit="wires"`. El descompilador puede recuperar ambos datos. Un componente sin etiqueta omite su texto y, en modo `full`, emite `data-node-label` vacío. La raíz `<svg>` declara `Arial, Helvetica, 'Liberation Sans', Arimo, sans-serif` como familia de fuentes predeterminada para la que se calculó la anchura del texto.

```schemd bounds="760x320" title="Same geometry in every mode"
source:PK "pack" at (90, 130) #blue [type=battery]
switch:KS "key" at (300, 130) #amber [type=pushbutton]
load:MS "motor" at (540, 130) #emerald [type=motor]

PK.positive -> KS.in #blue [line]
KS.out -> MS.in #emerald [line]
```

El modo `full` conserva identificadores locales al diagrama y proporciona objetivos accesibles para los terminales. La salida excluye scripts, fuentes externas, imágenes ráster, URL de datos y `foreignObject`.

<!-- /schemd-section -->

<!-- schemd-section: id=optimization; eyebrow=02 / Bytes; title=Reutilice símbolos canónicos; example-title=Repeated Zener diodes -->

Los componentes idénticos comparten una definición `<symbol>`. La orientación solo requiere girar cada instancia. Una puerta o bloque [ajustado](/docs/1.3/fit) comparte su definición con componentes cuyos terminales ocupan las mismas posiciones, porque su forma depende de los cables. Las familias ausentes de un diagrama no añaden bytes. Por ello, un dibujo grande compuesto por pocos componentes distintos conserva un tamaño reducido.

```schemd bounds="820x300" title="Repeated Zener diodes"
diode:ZA at (130, 120) #rose [type=zener]
diode:ZB at (350, 120) #rose [type=zener orientation=down]
diode:ZC at (580, 120) #rose [type=zener orientation=left]
```

Los tres diodos Zener comparten un símbolo y omiten sus etiquetas. Cada instancia requiere una referencia, un giro y su designador.

<!-- /schemd-section -->
