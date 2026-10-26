<!-- schemd-doc: id=limits; label=Presupuestos de recursos; title=Compile código escrito por otras personas; summary=Establezca un presupuesto por compilación para rechazar un documento demasiado grande en la declaración que lo supera, antes del trazado.; category=Operar con seguridad; order=95 -->

<!-- schemd-expect-page: unconnected-component, disconnected-subcircuit -->
<!-- Estos ejemplos muestran presupuestos, no conectividad. -->

Un documento puede declarar tantos componentes y conexiones como pueda colocar. La versión 0.4 eliminó los límites de 512 componentes y 2,048 conexiones. El compilador tiene un coste lineal respecto a ambos y compila sesenta y cuatro mil componentes en aproximadamente un segundo.

Ese comportamiento predeterminado es adecuado para código bajo el control de la aplicación. No lo es para código de otras fuentes, como un bloque Markdown en un comentario o un campo de un CMS. Ese código debe compilarse con un presupuesto.

<!-- schemd-section: id=budget; eyebrow=01 / Presupuestos; title=Rechace un documento demasiado grande antes de trazarlo; example-title=A short figure inside a tight budget -->

```ts
compileSchematic(source, {
	...fence,
	limits: { components: 400, connections: 1_500, sourceCharacters: 64_000 }
});
// SchematicSyntaxError: Line 401: Schematic exceeds the 400 component limit.
```

El rechazo se produce durante el análisis, en la declaración que supera el límite. En ese momento no se ha comprobado la geometría, trazado ningún cable ni generado marcado. Ese es el propósito de un presupuesto: reducir el coste del rechazo.

```schemd bounds="720x300" title="A short figure inside a tight budget"
port:KEY "key" at (80, 150) #blue
resistor:RS "10 k\Omega" at (300, 150) #amber
port:GPIO "GPIO 4" at (620, 150) #emerald

KEY.out -> RS.in #blue [ortho]
RS.out -> GPIO.in #emerald [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=fields; eyebrow=02 / Campos; title=Todos los campos son opcionales; example-title=A corridor with a budget -->

Todos los campos son opcionales y un campo omitido conserva su valor predeterminado. Por tanto, no pasar nada produce exactamente la misma compilación que antes de que existiera la opción. `sourceCharacters` también limita la expansión de los [subcircuitos](/docs/1.3/subcircuits). Una instancia abrevia las declaraciones que representa y las instancias anidadas podrían convertir un documento corto en uno sin límite. `Infinity` especifica expresamente la ausencia de límite y los dos recuentos lo utilizan como valor predeterminado.

| Campo              | Valor predeterminado | Limita                                                    |
| ------------------ | -------------------- | --------------------------------------------------------- |
| `components`       | sin límite           | declaraciones de componentes                              |
| `connections`      | sin límite           | conexiones dirigidas                                      |
| `sourceCharacters` | 16,777,216           | caracteres UTF-16 leídos y expansión de subcircuitos      |
| `wireCrossings`    | 32,768               | intersecciones ortogonales antes de abandonar el trazado  |
| `svgOutputBytes`   | 268,435,456          | bytes UTF-8 del marcado generado                          |
| `placementDepth`   | 64                   | cadena más larga de colocaciones relativas                |
| `routingAttempts`  | 12                   | rondas de negociación antes de que el conflicto sea fatal |

`routingAttempts` es el único presupuesto cuyo coste recae en los documentos que fallan. Un diagrama cuyas redes se trazan en la primera pasada nunca negocia y no incurre en ese coste. Un diagrama que no puede trazarse paga cada ronda antes de recibir el diagnóstico. Para código de otras fuentes debe mantenerse bajo o establecerse en `1` para prohibir por completo el contacto y no negociar nunca.

Los demás valores predeterminados limitan la asignación de memoria, no el tamaño del diagrama. Están muy por encima de cualquier dibujo legible, por lo que actúan como protección ante una entrada descontrolada. Una aplicación que necesite una política debe establecer sus propios valores.

```schemd bounds="800x370" title="A corridor with a budget"
port:PIN2 "P" at (70, 110) #blue
capacitor:CK "C" at (330, 110) #cyan [orientation=down]
component:PACK "battery pack" at (330, 260) #slate [width=170 height=70]
port:POUT "Q" at (700, 110) #emerald

PIN2.out -> CK.in #blue [ortho]
CK.out -> POUT.in #emerald [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=contract; eyebrow=03 / Contrato; title=Qué garantiza el compilador sobre un presupuesto; example-title=Power and sense on one sheet -->

Un presupuesto se resuelve una vez por compilación y se entrega tanto al analizador como al renderizador. Un accesor no puede dar a una pasada un valor amplio y a la otra uno estricto, lo que dejaría el documento sin comprobar frente a ninguno de los dos.

Un presupuesto no se restringe a los valores predeterminados. Una aplicación que aumenta `svgOutputBytes` ha decidido que puede asumir esa asignación de memoria y el compilador acepta la decisión.

Un campo mal escrito es un error. `limits: { component: 4 }` lanza `Unknown compiler limit component.` Un límite que una aplicación cree haber establecido, pero que no ha establecido, es peor que no tener límite.

`SCHEMATIC_LIMITS` informa de los valores predeterminados. Sus dos recuentos ilimitados son `Infinity`, que `JSON.stringify` representa como `null`, por lo que una API que los exponga necesita una función de sustitución.

```schemd bounds="780x380" title="Power and sense on one sheet"
port:IN3 "input" at (90, 180) #emerald
port:OUT3 "output" at (670, 180) #emerald
port:PB3 "probe'" at (390, 300) #rose [orientation=up]
port:PT3 "probe" at (390, 80) #rose [orientation=down]

IN3.out -> OUT3.in #emerald [ortho net=POWER]
PT3.out -> PB3.out #rose [ortho net=SENSE]
```

<!-- /schemd-section -->

<!-- schemd-section: id=timeout; eyebrow=04 / Tiempo; title=Un presupuesto no es un tiempo máximo; example-title=Few lines, real routing work -->

Todos los campos anteriores limitan un tamaño y ninguno limita el tiempo. Un documento pequeño puede seguir siendo costoso de trazar. Cada red requiere una búsqueda en la retícula y el trabajo de esa búsqueda depende de la congestión, cuando varias redes compiten por los mismos canales. El número de declaraciones tiene poca relación con ello.

Por tanto, los límites de recursos deben acompañarse de un plazo máximo impuesto desde fuera del worker de compilación. Ejecute el compilador síncrono en un worker que el entorno pueda terminar cuando se agote el tiempo. Un `AbortSignal` o un `Promise.race` alrededor de una llamada en el mismo hilo no pueden interrumpirla. Una cola puede limitar el tiempo de espera, pero el trabajo en curso sigue necesitando un worker que se pueda terminar. `wireCrossings` limita específicamente la pasada de cruces. Es lo más cercano a un límite de trabajo que ofrece el compilador, aunque no sustituye un tiempo máximo.

```schemd bounds="740x330" title="Few lines, real routing work"
port:MI "M" at (80, 120) #blue
port:MO "M'" at (640, 260) #blue
port:NI "N" at (80, 260) #amber
port:NO "N'" at (640, 120) #amber

MI.out -> MO.in #blue [ortho]
NI.out -> NO.in #amber [ortho]
```

<!-- /schemd-section -->
