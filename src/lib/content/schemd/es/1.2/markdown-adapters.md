<!-- schemd-doc: id=markdown-adapters; label=Procesos de Markdown; title=Compile solo bloques schemd canónicos; summary=Deje el análisis de la prosa al entorno y compile bloques schemd delimitados con diagnósticos exactos.; category=Conectar herramientas; order=90 -->

<!-- schemd-section: id=fences; eyebrow=01 / Markdown; title=Analice la cadena de información antes que el cuerpo; example-title=Markdown adapter fixture -->

La cadena de información pasa a `parseSchematicFence` antes de procesar el cuerpo. Cuando devuelve `undefined`, el bloque pertenece a otro formato y vuelve directamente al analizador del entorno. En caso contrario, se compila el cuerpo y se informa de `SchematicSyntaxError.line`. Silenciar un ejemplo defectuoso solo hace que termine publicándose.

```ts
const fence = parseSchematicFence(token.info);
if (!fence) return next(token);
return compileSchematic(token.text, { ...fence, mode: 'default' }).svg;
```

```schemd bounds="780x480" title="Markdown adapter fixture"
source:VY "3.3 V" at (80, 170) #blue [type=voltage-dc orientation=up]
resistor:RTH "NTC 10 k\Omega" at (300, 90) #amber [type=thermistor]
junction:NTC at (500, 90) #cyan
resistor:RBT "10 k\Omega" at (500, 230) #amber [orientation=down]
port:ADC "to ADC" at (680, 90) #emerald
ground:GY "0 V" at (500, 400) #slate

VY.positive -> RTH.in #blue [ortho]
RTH.out -> NTC.node #amber [ortho]
NTC.node -> RBT.in #cyan [ortho]
NTC.node -> ADC.in #emerald [ortho marker-end=arrow]
RBT.out -> GY.in #slate [ortho]
VY.negative -> GY.in #slate [ortho]
```

Este sitio compila todos los bloques con versión en su propia suite de pruebas; así evita que un ejemplo de la documentación sea una mera ilustración. Cada línea de documentación conserva sus propios ejemplos. Nunca se añade sintaxis nueva a una línea anterior, por lo que las páginas de la versión 1.2 son las únicas que omiten etiquetas.

<!-- /schemd-section -->
