<!-- schemd-doc: id=limits; label=Límites de recursos; title=Compile código fuente que no ha escrito; summary=Establezca límites por compilación para rechazar un documento demasiado grande en la declaración que los supera, antes de trazarlo.; category=Operar con seguridad; order=95 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Estos ejemplos muestran límites de recursos, no conectividad. -->

Un documento puede declarar tantos componentes y conexiones como sea capaz de colocar. La versión 0.4 eliminó los máximos de 512 componentes y 2,048 conexiones. El compilador tiene un coste lineal respecto a ambos, y sesenta y cuatro mil componentes se compilan en aproximadamente un segundo.

Ese valor predeterminado es adecuado para código fuente bajo el control del entorno. No lo es para código procedente de otros lugares, como un bloque Markdown en un comentario o un campo de un CMS. Ese código debe compilarse con límites de recursos.

<!-- schemd-section: id=budget; eyebrow=01 / Límites; title=Rechace un documento demasiado grande antes de trazarlo; example-title=A small figure inside a tight budget -->

```ts
compileSchematic(source, {
	...fence,
	limits: { components: 400, connections: 1_500, sourceCharacters: 64_000 }
});
// SchematicSyntaxError: Line 401: Schematic exceeds the 400 component limit.
```

El rechazo se produce durante el análisis, en la declaración que supera el límite. En ese momento aún no se ha comprobado la geometría, trazado ningún cable ni generado marcado. Esa es la finalidad de un límite de recursos: que rechazar un documento tenga un coste bajo.

```schemd bounds="720x300" title="A small figure inside a tight budget"
port:SW "switch" at (80, 150) #blue
resistor:RPU "47 k\Omega" at (300, 150) #amber
port:PIN "MCU pin" at (620, 150) #emerald

SW.out -> RPU.in #blue [ortho]
RPU.out -> PIN.in #emerald [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=fields; eyebrow=02 / Campos; title=Todos los campos son opcionales; example-title=A bounded corridor -->

Todos los campos son opcionales; los omitidos conservan sus valores predeterminados. Por tanto, si no se pasa ninguno, la compilación funciona exactamente como antes de que existiera la opción. `sourceCharacters` también limita la expansión de los [subcircuitos](/docs/1.2/subcircuits). Una instancia es una abreviatura de las declaraciones que representa; de otro modo, las instancias anidadas podrían convertir un documento breve en uno sin límite. `Infinity` indica explícitamente que no hay límite, y es el valor predeterminado de los dos recuentos.

| Campo              | Valor predeterminado | Limita                                                            |
| ------------------ | -------------------- | ----------------------------------------------------------------- |
| `components`       | sin límite           | declaraciones de componentes                                      |
| `connections`      | sin límite           | conexiones dirigidas                                              |
| `sourceCharacters` | 16,777,216           | caracteres UTF-16 leídos y expansión de subcircuitos              |
| `wireCrossings`    | 32,768               | intersecciones ortogonales antes de abandonar el trazado          |
| `svgOutputBytes`   | 268,435,456          | bytes UTF-8 del marcado generado                                  |
| `placementDepth`   | 64                   | cadena más larga de colocaciones relativas                        |
| `routingAttempts`  | 12                   | rondas de negociación antes de que el conflicto sea irrecuperable |

`routingAttempts` es el único límite cuyo coste recae en los documentos que fallan. Un diagrama cuyas redes se trazan en la primera pasada nunca negocia y no incurre en ese coste. Un diagrama que no se puede trazar paga cada ronda antes de recibir el diagnóstico. Para código fuente de otros orígenes conviene mantener un valor bajo o establecerlo en `1` para prohibir por completo el contacto y no negociar nunca.

Los demás valores predeterminados limitan las asignaciones de memoria, no el tamaño del diagrama. Están muy por encima de cualquier dibujo legible, por lo que actúan como protección ante entradas descontroladas. Si el entorno necesita una política, debe establecer sus propios valores.

```schemd bounds="800x370" title="A bounded corridor"
port:PL "P" at (70, 110) #blue
inductor:LZ "L" at (330, 110) #purple [orientation=down]
component:SHD "shield can" at (330, 260) #slate [width=160 height=70]
port:QL "Q" at (700, 110) #emerald

PL.out -> LZ.in #blue [ortho]
LZ.out -> QL.in #emerald [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=contract; eyebrow=03 / Contrato; title=Qué garantiza el compilador sobre los límites; example-title=Two nets on one sheet -->

Los límites se resuelven una vez por compilación y se entregan tanto al analizador como al renderizador. Un accesor no puede dar a una pasada un valor amplio y a la otra uno estricto, lo que dejaría el documento sin comprobar frente a ninguno de los dos.

Los límites no se restringen a los valores predeterminados. Si el entorno aumenta `svgOutputBytes`, decide que puede asumir esa asignación de memoria, y el compilador acepta la decisión.

Un campo mal escrito produce un error. `limits: { component: 4 }` lanza `Unknown compiler limit component.` Un límite que el entorno cree haber establecido, pero no ha establecido, es peor que no tener ninguno.

`SCHEMATIC_LIMITS` informa de los valores predeterminados. Sus dos recuentos sin límite son `Infinity`, que `JSON.stringify` representa como `null`; por ello, una API que los exponga necesita una función de reemplazo.

```schemd bounds="780x370" title="Two nets on one sheet"
port:LT "left" at (90, 170) #emerald
port:RT "right" at (670, 170) #emerald
port:BT "bottom" at (390, 290) #rose [orientation=up]
port:TP "top" at (390, 80) #rose [orientation=down]

LT.out -> RT.in #emerald [ortho net=SUPPLY]
TP.out -> BT.out #rose [ortho net=DATA]
```

<!-- /schemd-section -->

<!-- schemd-section: id=timeout; eyebrow=04 / Tiempo; title=Un límite de recursos no es un tiempo máximo; example-title=Little source, real routing work -->

Todos los campos anteriores limitan un tamaño; ninguno limita el tiempo. Un documento pequeño puede seguir siendo costoso de trazar. Cada red requiere una búsqueda en una retícula, y el trabajo de esa búsqueda depende de la congestión, donde las redes compiten por los mismos canales. El número de declaraciones tiene poca relación con ello.

Por tanto, los límites de recursos deben acompañarse de un plazo máximo impuesto desde fuera del worker de compilación. Ejecute el compilador síncrono en un worker que el entorno pueda terminar cuando se agote el tiempo. Un `AbortSignal` o un `Promise.race` alrededor de una llamada en el mismo hilo no pueden interrumpirla. Una cola puede limitar el tiempo de espera, pero el trabajo en curso sigue necesitando un worker que se pueda terminar. `wireCrossings` limita específicamente la pasada de cruces. Es lo más cercano a un límite de trabajo que ofrece el compilador, aunque no sustituye un tiempo máximo.

```schemd bounds="740x330" title="Little source, real routing work"
port:IA "A" at (80, 110) #blue
port:OA "A'" at (640, 250) #blue
port:IB "B" at (80, 250) #amber
port:OB "B'" at (640, 110) #amber

IA.out -> OA.in #blue [ortho]
IB.out -> OB.in #amber [ortho]
```

<!-- /schemd-section -->
