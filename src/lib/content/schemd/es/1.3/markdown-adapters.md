<!-- schemd-doc: id=markdown-adapters; label=Procesamiento de Markdown; title=Compile solo los bloques schemd canónicos; summary=Deje el análisis de la prosa al sistema anfitrión y compile bloques schemd acotados con diagnósticos precisos.; category=Conectar herramientas; order=90 -->

<!-- schemd-section: id=fences; eyebrow=01 / Markdown; title=Analice la cadena de información antes del contenido; example-title=Markdown adapter fixture -->

La cadena de información se entrega a `parseSchematicFence` antes de procesar el contenido. Cuando devuelve `undefined`, el bloque corresponde a otro lenguaje y se devuelve directamente al analizador anfitrión. En los demás casos se compila el contenido y se informa `SchematicSyntaxError.line`. Ocultar un error en un ejemplo permite que se publique sin corregirlo.

```ts
const fence = parseSchematicFence(token.info);
if (!fence) return next(token);
return compileSchematic(token.text, { ...fence, mode: 'default' }).svg;
```

```schemd bounds="780x480" title="Markdown adapter fixture"
source:VZ "5 V" at (80, 170) #blue [type=voltage-dc orientation=up]
resistor:RLDR "LDR" at (300, 90) #amber [type=ldr]
junction:NL at (500, 90) #cyan
resistor:RFX "47 k\Omega" at (500, 230) #amber [orientation=down]
port:LUX "to ADC" at (680, 90) #emerald
ground:GL "0 V" at (500, 400) #slate

VZ.positive -> RLDR.in #blue [ortho]
RLDR.out -> NL.node #amber [ortho]
NL.node -> RFX.in #cyan [ortho]
NL.node -> LUX.in #emerald [ortho marker-end=arrow]
RFX.out -> GL.in #slate [ortho]
VZ.negative -> GL.in #slate [ortho]
```

Este sitio compila todos los bloques de cada versión en su propia batería de pruebas. Así se comprueba que los ejemplos de la documentación funcionan. La documentación de cada línea de versiones conserva sus propios ejemplos. La sintaxis nueva se incorpora a la línea correspondiente; por ello, solo las páginas 1.2 y 1.3 omiten etiquetas.

<!-- /schemd-section -->
