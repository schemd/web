<!-- schemd-doc: id=diagnostics; label=Diagnostics; title=See every problem at once; summary=diagnoseSchematic reports every problem in a document in one call, each with its line, its column range, and a stable code.; category=Author diagrams; order=47 -->

<!-- schemd-section: id=all-at-once; eyebrow=01 / Report; title=Every problem, in source order; example-title=The corrected high-pass filter; example-summary=The document below, once both diagnostics are fixed. -->

`compileSchematic` stops at the first problem, because a compiler that has found one mistake cannot draw the document. An editor needs every mistake at once, each pointing at the exact characters to underline. `diagnoseSchematic` provides that.

```ts
import { diagnoseSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="760x420" title="Filter"')!;
const diagnostics = diagnoseSchematic(source, fence);
// [{ code, message, line, column, endColumn, severity }, …]
```

It throws only for arguments that are not a document. For anything wrong inside the document it returns a list in source order, and an empty list means the document compiles. Given this source:

```text
source:VAC "V_{ac}" at (90, 170) #blue [type=voltage-ac]
capacitor:C4 "220 nF" at (300, 170) #cyan [rating=50V]
resistor:R4 "10 k\Omega" below C9 by 80 #amber [orientation=down]
```

both problems come back together, each with the columns of the token at fault:

```text
2:37–55  option     Option rating is not supported.
3:32–34  placement  R4 is placed relative to C9, which the document never declares.
                    Declare C9 anywhere in the document, or place R4 with at (x, y).
```

Columns are one-based and `endColumn` is exclusive. Hence `line.slice(column - 1, endColumn - 1)` is exactly the offending text. On line 2 it is the declaration's tail, `#cyan [rating=50V]`, where the bad option sits, and on line 3 it is `C9`. Every message says how to fix what it reports, in addition to what is wrong.

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

<!-- schemd-section: id=codes; eyebrow=02 / Codes; title=A stable code for every kind of problem; example-title=A sound document; example-summary=Declarations, references and topology all pass, so placement, geometry and routing run. -->

Each diagnostic carries a `code` that a host can switch on without parsing prose. `SCHEMATIC_DIAGNOSTIC_CODES` lists the codes in the order the compiler meets them:

| Code        | Raised by                                                                   |
| ----------- | --------------------------------------------------------------------------- |
| `syntax`    | a line that is not a declaration, a connection, or block syntax             |
| `option`    | an unknown, duplicated, or ill-typed option for the kind we named           |
| `limit`     | a document past one of its [resource budgets](/docs/1.3/limits)             |
| `reference` | a connection to a part or terminal that does not exist                      |
| `topology`  | conflicting nets at one terminal, or a bus width that does not match        |
| `placement` | a relation to nothing, a cycle, a negative distance, or too long a chain    |
| `geometry`  | a part outside the fence, bodies that overlap, or a fit that cannot be made |
| `routing`   | a wire the router could not place, with what to move                        |

Two rules keep the list honest. First, a declaration that fails does not cascade. Its ID is set aside, so a mistyped kind on one line does not reappear as an unknown part on every line that wires to it. Second, geometry and routing run only on a document whose declarations are sound. A drawing of a document with a broken declaration would show something the author never wrote.

References are treated differently. The name of a terminal depends on its part's kind and never on where the part sits. A broken relative placement therefore does not hide a mistyped terminal elsewhere, and every connection is still checked.

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

<!-- schemd-section: id=editors; eyebrow=03 / Editors; title=Underline it where it was typed; example-title=Live in the playground; example-summary=The playground underlines exactly these columns as you type. -->

A thrown error carries the same fields. `SchematicSyntaxError` has `line`, `column`, `endColumn` and `code`, so a host that compiles directly can underline the one problem it was given without calling the diagnostics API at all:

```ts
try {
	compileSchematic(source, fence);
} catch (error) {
	if (error instanceof SchematicSyntaxError) {
		underline(error.line, error.column, error.endColumn, error.message);
	}
}
```

A line rewritten by a [sub-circuit](/docs/1.3/subcircuits) parameter carries no column, since its columns would point at text the author never wrote. Its line still points at the declaration.

The [playground](/playground/1.3.0) does exactly this during typing. It underlines every reported range and lists the problems beside the source. Until the document is sound again, the last drawing that compiled stays on screen, dimmed.

```schemd bounds="760x340" title="Live in the playground"
port:AUD "A" at (100, 150) #violet
capacitor:CC9 "10 \mu F" right-of AUD by 150 #cyan [type=polarized]
load:SPK "speaker" right-of CC9 by 150 #emerald [type=speaker]

AUD.out -> CC9.in #violet [ortho]
CC9.out -> SPK.in #cyan [ortho]
```

<!-- /schemd-section -->
