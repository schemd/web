<!-- schemd-doc: id=diagnostics; label=Diagnósticos; title=Vea todos los problemas a la vez; summary=diagnoseSchematic informa de todos los problemas de un documento en una llamada, cada uno con su línea, su intervalo de columnas y un código estable.; category=Crear diagramas; order=47 -->

<!-- schemd-section: id=all-at-once; eyebrow=01 / Informe; title=Todos los problemas en orden de aparición; example-title=The corrected LC filter; example-summary=El documento de abajo tras corregir ambos diagnósticos. -->

`compileSchematic` se detiene en el primer problema, porque un compilador que ha encontrado un error no puede dibujar el documento. Un editor necesita todos los errores a la vez, cada uno señalando los caracteres exactos que debe subrayar. `diagnoseSchematic` proporciona esa información.

```ts
import { diagnoseSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="760x420" title="Filter"')!;
const diagnostics = diagnoseSchematic(source, fence);
// [{ code, message, line, column, endColumn, severity }, …]
```

Solo lanza una excepción para argumentos que no sean un documento. Para cualquier problema dentro del documento devuelve una lista en orden de aparición; una lista vacía significa que el documento se compila. Dado este código fuente:

```text
source:VDC "V_{dc}" at (90, 170) #blue [type=voltage-dc]
inductor:L2 "100 \mu H" at (300, 170) #purple [core=ferrite]
capacitor:C3 "220 \mu F" below L9 by 80 #cyan [orientation=down]
```

ambos problemas se devuelven juntos, cada uno con las columnas del elemento que falla:

```text
2:39–61  option     Option core is not supported.
3:32–34  placement  C3 is placed relative to L9, which the document never declares.
                    Declare L9 anywhere in the document, or place C3 with at (x, y).
```

Las columnas comienzan en uno y `endColumn` es exclusivo. Por tanto, `line.slice(column - 1, endColumn - 1)` es exactamente el texto que causa el problema. En la línea 2 es la parte final de la declaración, `#purple [core=ferrite]`, donde se encuentra la opción incorrecta; en la línea 3 es `L9`. Cada mensaje indica cómo corregir el problema, además de explicar qué está mal.

```schemd bounds="760x600" title="The corrected LC filter"
source:VDC "V_{dc}" at (90, 170) #blue [type=voltage-dc]
inductor:L2 "100 \mu H" at (300, 170) #purple
capacitor:C3 "220 \mu F" below L2 by 80 #cyan [type=polarized orientation=down]
ground:G3 "0 V" below C3 by 20 aligned-x with C3 #slate

VDC.positive -> L2.in #blue [ortho]
L2.out -> C3.in #purple [ortho]
C3.out -> G3.in #slate [ortho]
VDC.negative -> G3.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=codes; eyebrow=02 / Códigos; title=Un código estable para cada tipo de problema; example-title=A sound document; example-summary=Las declaraciones, las referencias y la topología superan las comprobaciones, por lo que se ejecutan la colocación, la geometría y el trazado. -->

Cada diagnóstico incluye un `code` que el entorno puede usar para decidir su comportamiento sin analizar la prosa. `SCHEMATIC_DIAGNOSTIC_CODES` enumera los códigos en el orden en que los encuentra el compilador:

| Código      | Lo produce                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `syntax`    | una línea que no es una declaración, una conexión ni sintaxis de bloque                           |
| `option`    | una opción desconocida, duplicada o con un tipo incorrecto para el componente indicado            |
| `limit`     | un documento que supera uno de sus [límites de recursos](/docs/1.2/limits)                        |
| `reference` | una conexión a un componente o terminal que no existe                                             |
| `topology`  | redes incompatibles en un terminal o una anchura de bus que no coincide                           |
| `placement` | una relación sin referencia válida, un ciclo, una distancia negativa o una cadena demasiado larga |
| `geometry`  | un componente fuera de los límites del bloque, cuerpos que se solapan o un ajuste imposible       |
| `routing`   | un cable que el trazador no pudo colocar, con indicaciones sobre qué mover                        |

Dos reglas mantienen la precisión de la lista. Primero, una declaración que falla no genera errores en cascada. Su ID se reserva, de modo que un tipo mal escrito en una línea no reaparece como componente desconocido en todas las líneas que se conectan a él. Segundo, la geometría y el trazado solo se ejecutan en documentos cuyas declaraciones son válidas. Dibujar un documento con una declaración defectuosa mostraría algo que el autor nunca escribió.

Las referencias reciben un tratamiento distinto. El nombre de un terminal depende del tipo de su componente, nunca de dónde se sitúe. Por ello, una colocación relativa defectuosa no oculta un terminal mal escrito en otra parte, y todas las conexiones se siguen comprobando.

```schemd bounds="760x440" title="A sound document"
port:REQ at (100, 120) #blue
and:G8 "AND" right-of REQ by 160 #purple [inputs=2]
port:GRANT right-of G8 by 160 #emerald
clock:SCK "SAMPLE" below G8 by 110 aligned-x with G8 #amber

REQ.out -> G8.in1 #blue [ortho digital]
SCK.out -> G8.in2 #amber [ortho digital]
G8.out1 -> GRANT.in #emerald [ortho digital]
```

<!-- /schemd-section -->

<!-- schemd-section: id=editors; eyebrow=03 / Editores; title=Subraye el problema donde se escribió; example-title=Live in the playground; example-summary=El área de pruebas subraya exactamente estas columnas mientras se escribe. -->

Una excepción incluye los mismos campos. `SchematicSyntaxError` tiene `line`, `column`, `endColumn` y `code`, por lo que un entorno que compila directamente puede subrayar el único problema recibido sin llamar a la API de diagnósticos:

```ts
try {
	compileSchematic(source, fence);
} catch (error) {
	if (error instanceof SchematicSyntaxError) {
		underline(error.line, error.column, error.endColumn, error.message);
	}
}
```

Una línea reescrita por un parámetro de [subcircuito](/docs/1.2/subcircuits) no incluye columna, porque sus columnas señalarían un texto que el autor nunca escribió. Su línea sigue apuntando a la declaración.

El [área de pruebas](/playground/1.2.0) hace exactamente esto mientras se escribe. Subraya todos los intervalos notificados y enumera los problemas junto al código fuente. Hasta que el documento vuelva a ser válido, el último dibujo que se compiló permanece en pantalla, atenuado.

```schemd bounds="760x340" title="Live in the playground"
port:DRV "D" at (100, 150) #violet
resistor:RB8 "1 k\Omega" right-of DRV by 150 #amber
load:BZ8 "buzzer" right-of RB8 by 150 #emerald [type=buzzer]

DRV.out -> RB8.in #violet [ortho]
RB8.out -> BZ8.in #amber [ortho]
```

<!-- /schemd-section -->
