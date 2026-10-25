<!-- schemd-doc: id=diagnostics; label=Diagnostics; title=See every problem at once; summary=diagnoseSchematic reports every problem in a document in one call, each with its line, its column range, and a stable code.; category=Author diagrams; order=47 -->

<!-- schemd-section: id=all-at-once; eyebrow=01 / Report; title=Every problem, in source order; example-title=The corrected LC filter; example-summary=The document below, once both diagnostics are fixed. -->

`compileSchematic` stops at the first problem, because a compiler that has found one mistake cannot draw the document. An editor needs every mistake at once, each pointing at the exact characters to underline. `diagnoseSchematic` provides that.

```ts
import { diagnoseSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="760x420" title="Filter"')!;
const diagnostics = diagnoseSchematic(source, fence);
// [{ code, message, line, column, endColumn, severity }, …]
```

It throws only for arguments that are not a document. For anything wrong inside the document it returns a list in source order, and an empty list means the document compiles. Given this source:

```text
source:VDC "V_{dc}" at (90, 170) #blue [type=voltage-dc]
inductor:L2 "100 \mu H" at (300, 170) #purple [core=ferrite]
capacitor:C3 "220 \mu F" below L9 by 80 #cyan [orientation=down]
```

both problems come back together, each with the columns of the token at fault:

```text
2:39–61  option     Option core is not supported.
3:32–34  placement  C3 is placed relative to L9, which the document never declares.
                    Declare L9 anywhere in the document, or place C3 with at (x, y).
```

Columns are one-based and `endColumn` is exclusive. Hence `line.slice(column - 1, endColumn - 1)` is exactly the offending text. On line 2 it is the declaration's tail, `#purple [core=ferrite]`, where the bad option sits, and on line 3 it is `L9`. Every message says how to fix what it reports, in addition to what is wrong.

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

<!-- schemd-section: id=codes; eyebrow=02 / Codes; title=A stable code for every kind of problem; example-title=A sound document; example-summary=Declarations, references and topology all pass, so placement, geometry and routing run. -->

Each diagnostic carries a `code` that a host can switch on without parsing prose. `SCHEMATIC_DIAGNOSTIC_CODES` lists the codes in the order the compiler meets them:

| Code        | Raised by                                                                   |
| ----------- | --------------------------------------------------------------------------- |
| `syntax`    | a line that is not a declaration, a connection, or block syntax             |
| `option`    | an unknown, duplicated, or ill-typed option for the kind we named           |
| `limit`     | a document past one of its [resource budgets](/docs/1.2/limits)             |
| `reference` | a connection to a part or terminal that does not exist                      |
| `topology`  | conflicting nets at one terminal, or a bus width that does not match        |
| `placement` | a relation to nothing, a cycle, a negative distance, or too long a chain    |
| `geometry`  | a part outside the fence, bodies that overlap, or a fit that cannot be made |
| `routing`   | a wire the router could not place, with what to move                        |

Two rules keep the list honest. First, a declaration that fails does not cascade. Its ID is set aside, so a mistyped kind on one line does not reappear as an unknown part on every line that wires to it. Second, geometry and routing run only on a document whose declarations are sound. A drawing of a document with a broken declaration would show something the author never wrote.

References are treated differently. The name of a terminal depends on its part's kind and never on where the part sits. A broken relative placement therefore does not hide a mistyped terminal elsewhere, and every connection is still checked.

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

A line rewritten by a [sub-circuit](/docs/1.2/subcircuits) parameter carries no column, since its columns would point at text the author never wrote. Its line still points at the declaration.

The [playground](/playground/1.2.0) does exactly this during typing. It underlines every reported range and lists the problems beside the source. Until the document is sound again, the last drawing that compiled stays on screen, dimmed.

```schemd bounds="760x340" title="Live in the playground"
port:DRV "D" at (100, 150) #violet
resistor:RB8 "1 k\Omega" right-of DRV by 150 #amber
load:BZ8 "buzzer" right-of RB8 by 150 #emerald [type=buzzer]

DRV.out -> RB8.in #violet [ortho]
RB8.out -> BZ8.in #amber [ortho]
```

<!-- /schemd-section -->
