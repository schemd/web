<!-- schemd-doc: id=diagnostics; label=Diagnostics; title=See every problem at once; summary=diagnoseSchematic reports every problem in a document in one call, each with its line, its column range, and a stable code.; category=Author diagrams; order=47 -->

<!-- schemd-section: id=all-at-once; eyebrow=01 / Report; title=Every problem, in source order; example-title=The corrected filter; example-summary=The document below, once both diagnostics are fixed. -->

`compileSchematic` stops at the first problem, because a compiler that has found one mistake cannot draw the document. An editor wants something else: every mistake, at once, each pointing at the exact characters to underline. That is `diagnoseSchematic`.

```ts
import { diagnoseSchematic, parseSchematicFence } from '@schemd/core';

const fence = parseSchematicFence('schemd bounds="760x420" title="Filter"')!;
const diagnostics = diagnoseSchematic(source, fence);
// [{ code, message, line, column, endColumn, severity }, …]
```

It throws only for arguments that are not a document. For anything wrong _inside_ the document it returns a list, in source order, and an empty list means the document compiles. Give it this:

```text
source:VIN "V_{in}" at (90, 170) #blue [type=voltage-dc]
resistor:R1 "4.7 k\Omega" at (300, 170) #amber [tolerance=1%]
capacitor:C1 "100 nF" below R2 by 80 #cyan [orientation=down]
```

and both problems come back together, each with the columns of the token at fault:

```text
2:41–62  option     Option tolerance is not supported.
3:29–31  placement  C1 is placed relative to R2, which the document never declares.
                    Declare R2 anywhere in the document, or place C1 with at (x, y).
```

Columns are one-based and `endColumn` is exclusive, so `line.slice(column - 1, endColumn - 1)` is exactly the offending text — `[tolerance=1%]` and `R2` here. Every message says how to fix what it reports, not only what is wrong.

```schemd bounds="760x600" title="The corrected filter"
source:VIN "V_{in}" at (90, 170) #blue [type=voltage-dc]
resistor:R1 "4.7 k\Omega" at (300, 170) #amber
capacitor:C1 "100 nF" below R1 by 80 #cyan [orientation=down]
ground:G "0 V" below C1 by 20 aligned-x with C1 #slate

VIN.positive -> R1.in #blue [ortho]
R1.out -> C1.in #amber [ortho]
C1.out -> G.in #slate [ortho]
VIN.negative -> G.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=codes; eyebrow=02 / Codes; title=A stable code for every kind of problem; example-title=A sound document; example-summary=Declarations, references and topology all pass, so placement, geometry and routing run. -->

Each diagnostic carries a `code` a host can switch on without parsing prose. `SCHEMATIC_DIAGNOSTIC_CODES` lists them, in the order the compiler meets them:

| Code        | Raised by                                                                |
| ----------- | ------------------------------------------------------------------------ |
| `syntax`    | a line that is not a declaration, a connection, or block syntax          |
| `option`    | an unknown, duplicated, or ill-typed option for the kind we named        |
| `limit`     | a document past one of its [resource budgets](/docs/1.0/limits)          |
| `reference` | a connection to a part or terminal that does not exist                   |
| `topology`  | conflicting nets at one terminal, or a bus width that does not match     |
| `placement` | a relation to nothing, a cycle, a negative distance, or too long a chain |
| `geometry`  | a part outside the fence, or bodies that overlap                         |
| `routing`   | a wire the router could not place, with what to move                     |

Two rules keep the list honest. **A declaration that fails does not cascade.** Its id is set aside, so a mistyped kind on one line does not reappear as "unknown part" on every line that wires to it. **Geometry and routing run only on a document whose declarations are sound**, because a drawing of a document with a broken declaration would be a drawing of something we did not write.

```schemd bounds="760x440" title="A sound document"
port:EN "EN" at (100, 120) #blue
nand:G1 "NAND" right-of EN by 160 #purple [inputs=2]
port:RDY "RDY" right-of G1 by 160 #emerald
clock:CK "CLK" below G1 by 110 aligned-x with G1 #amber

EN.out -> G1.in1 #blue [ortho digital]
CK.out -> G1.in2 #amber [ortho digital]
G1.out1 -> RDY.in #emerald [ortho digital]
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

A line rewritten by a [sub-circuit](/docs/1.0/subcircuits) parameter carries no column, since its columns would point at text the author never wrote; its line still points at the declaration.

The [playground](/playground/1.0.0) does exactly this as we type: it underlines every reported range, lists the problems beside the source, and keeps the last drawing that compiled on screen, dimmed, until the document is sound again.

```schemd bounds="760x340" title="Live in the playground"
port:SRC "S" at (100, 150) #violet
resistor:RS "220 \Omega" right-of SRC by 150 #amber
diode:DL "on" right-of RS by 150 #emerald [type=led]

SRC.out -> RS.in #violet [ortho]
RS.out -> DL.anode #amber [ortho]
```

<!-- /schemd-section -->
