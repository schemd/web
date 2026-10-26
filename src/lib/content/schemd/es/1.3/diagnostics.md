<!-- schemd-doc: id=diagnostics; label=Diagnósticos; title=Vea todos los problemas a la vez; summary=diagnoseSchematic informa de todos los problemas de un documento en una llamada, cada uno con su línea, intervalo de columnas y código estable.; category=Crear diagramas; order=47 -->

<!-- schemd-section: id=all-at-once; eyebrow=01 / Informe; title=Todos los problemas, en el orden del código fuente; example-title=The corrected high-pass filter; example-summary=El documento siguiente, una vez corregidos ambos diagnósticos. -->

`compileSchematic` se detiene en el primer problema, porque un compilador que ha encontrado un error no puede dibujar el documento. Un editor necesita todos los errores a la vez, cada uno señalando los caracteres exactos que debe subrayar. `diagnoseSchematic` proporciona esa información.

```ts
import { diagnoseSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="760x420" title="Filter"')!;
const diagnostics = diagnoseSchematic(source, fence);
// [{ code, message, line, column, endColumn, severity }, …]
```

Solo lanza una excepción si los argumentos no constituyen un documento. Para cualquier error dentro del documento devuelve una lista en el orden del código fuente, y una lista vacía significa que el documento se compila. Con este código:

```text
source:VAC "V_{ac}" at (90, 170) #blue [type=voltage-ac]
capacitor:C4 "220 nF" at (300, 170) #cyan [rating=50V]
resistor:R4 "10 k\Omega" below C9 by 80 #amber [orientation=down]
```

se devuelven ambos problemas juntos, cada uno con las columnas del token incorrecto:

```text
2:37–55  option     Option rating is not supported.
3:32–34  placement  R4 is placed relative to C9, which the document never declares.
                    Declare C9 anywhere in the document, or place R4 with at (x, y).
```

Las columnas empiezan en uno y `endColumn` es exclusivo. Por tanto, `line.slice(column - 1, endColumn - 1)` es exactamente el texto incorrecto. En la línea 2 es el final de la declaración, `#cyan [rating=50V]`, donde está la opción incorrecta, y en la línea 3 es `C9`. Cada mensaje explica cómo corregir lo que informa, además de indicar el problema.

```schemd bounds="760x600" title="The corrected high-pass filter"
source:VAC "V_{ac}" at (90, 170) #blue [type=voltage-ac]
capacitor:C4 "220 nF" at (300, 170) #cyan
resistor:R4 "10 k\Omega" below C4 by 80 #amber [orientation=down]
ground:G4 "0 V" below R4 by 20 aligned-x with R4 #slate

VAC.positive -> C4.in #blue [ortho]
C4.out -> R4.in #cyan [ortho]
R4.out -> G4.in #slate [ortho]
VAC.negative -> G4.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=codes; eyebrow=02 / Códigos; title=Un código estable para cada tipo de problema; example-title=A sound document; example-summary=Las declaraciones, las referencias y la topología son válidas, por lo que se ejecutan la colocación, la geometría y el trazado. -->

Cada diagnóstico incluye un `code` que permite a una aplicación seleccionar su comportamiento sin analizar el texto. `SCHEMATIC_DIAGNOSTIC_CODES` enumera los códigos en el orden en que los encuentra el compilador:

| Código      | Se genera por                                                                              |
| ----------- | ------------------------------------------------------------------------------------------ |
| `syntax`    | una línea que no es una declaración, una conexión ni sintaxis de bloque                    |
| `option`    | una opción desconocida, duplicada o de tipo incorrecto para el tipo indicado               |
| `limit`     | un documento que supera uno de sus [presupuestos de recursos](/docs/1.3/limits)            |
| `reference` | una conexión a un componente o terminal que no existe                                      |
| `topology`  | redes en conflicto en un terminal o un ancho de bus que no coincide                        |
| `placement` | una relación sin referencia, un ciclo, una distancia negativa o una cadena demasiado larga |
| `geometry`  | un componente fuera de los límites, cuerpos solapados o un ajuste imposible                |
| `routing`   | un cable que el trazador no pudo colocar, con indicaciones de qué mover                    |

Dos reglas mantienen la precisión de la lista. En primer lugar, una declaración que falla no genera errores en cascada. Su ID se reserva, de modo que un tipo mal escrito en una línea no reaparece como un componente desconocido en todas las líneas que se conectan a él. En segundo lugar, la geometría y el trazado solo se ejecutan en un documento cuyas declaraciones sean válidas. Dibujar un documento con una declaración incorrecta mostraría algo que el autor nunca escribió.

Las referencias reciben un tratamiento distinto. El nombre de un terminal depende del tipo de su componente y nunca de su posición. Por tanto, una colocación relativa incorrecta no oculta un terminal mal escrito en otra parte y se siguen comprobando todas las conexiones.

```schemd bounds="760x440" title="A sound document"
port:ACK2 at (100, 120) #blue
xnor:G9 "XNOR" right-of ACK2 by 160 #purple [inputs=2]
port:SAME right-of G9 by 160 #emerald
clock:STB "STROBE" below G9 by 110 aligned-x with G9 #amber

ACK2.out -> G9.in1 #blue [ortho digital]
STB.out -> G9.in2 #amber [ortho digital]
G9.out1 -> SAME.in #emerald [ortho digital]
```

<!-- /schemd-section -->

<!-- schemd-section: id=editors; eyebrow=03 / Editores; title=Subraye el texto donde se escribió; example-title=Live in the playground; example-summary=El área de pruebas subraya exactamente estas columnas mientras se escribe. -->

Un error lanzado incluye los mismos campos. `SchematicSyntaxError` tiene `line`, `column`, `endColumn` y `code`, por lo que una aplicación que compila directamente puede subrayar el problema recibido sin llamar a la API de diagnósticos:

```ts
try {
	compileSchematic(source, fence);
} catch (error) {
	if (error instanceof SchematicSyntaxError) {
		underline(error.line, error.column, error.endColumn, error.message);
	}
}
```

Una línea reescrita por un parámetro de [subcircuito](/docs/1.3/subcircuits) no incluye columna, ya que sus columnas apuntarían a texto que el autor nunca escribió. Su línea sigue apuntando a la declaración.

El [área de pruebas](/playground/1.3.0) hace precisamente esto mientras se escribe. Subraya cada intervalo informado y enumera los problemas junto al código fuente. Hasta que el documento vuelve a ser válido, permanece en pantalla el último dibujo que se compiló, atenuado.

```schemd bounds="760x340" title="Live in the playground"
port:AUD "A" at (100, 150) #violet
capacitor:CC9 "10 \mu F" right-of AUD by 150 #cyan [type=polarized]
load:SPK "speaker" right-of CC9 by 150 #emerald [type=speaker]

AUD.out -> CC9.in #violet [ortho]
CC9.out -> SPK.in #cyan [ortho]
```

<!-- /schemd-section -->
