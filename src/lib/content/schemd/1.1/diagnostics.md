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
source:VAC "V_{ac}" at (90, 170) #blue [type=voltage-ac]
resistor:R2 "2.2 k\Omega" at (300, 170) #amber [tolerance=1%]
capacitor:C2 "47 nF" below R3 by 80 #cyan [orientation=down]
```

and both problems come back together, each with the columns of the token at fault:

```text
2:41–62  option     Option tolerance is not supported.
3:28–30  placement  C2 is placed relative to R3, which the document never declares.
                    Declare R3 anywhere in the document, or place C2 with at (x, y).
```

Columns are one-based and `endColumn` is exclusive, so `line.slice(column - 1, endColumn - 1)` is exactly the offending text — the declaration's tail, `#amber [tolerance=1%]`, where the bad option sits, and `R3` here. Every message says how to fix what it reports, not only what is wrong.

```schemd bounds="760x600" title="The corrected filter"
source:VAC "V_{ac}" at (90, 170) #blue [type=voltage-ac]
resistor:R2 "2.2 k\Omega" at (300, 170) #amber
capacitor:C2 "47 nF" below R2 by 80 #cyan [orientation=down]
ground:G2 "0 V" below C2 by 20 aligned-x with C2 #slate

VAC.positive -> R2.in #blue [ortho]
R2.out -> C2.in #amber [ortho]
C2.out -> G2.in #slate [ortho]
VAC.negative -> G2.in #slate [ortho]
```

<!-- /schemd-section -->

<!-- schemd-section: id=codes; eyebrow=02 / Codes; title=A stable code for every kind of problem; example-title=A sound document; example-summary=Declarations, references and topology all pass, so placement, geometry and routing run. -->

Each diagnostic carries a `code` a host can switch on without parsing prose. `SCHEMATIC_DIAGNOSTIC_CODES` lists them, in the order the compiler meets them:

| Code        | Raised by                                                                   |
| ----------- | --------------------------------------------------------------------------- |
| `syntax`    | a line that is not a declaration, a connection, or block syntax             |
| `option`    | an unknown, duplicated, or ill-typed option for the kind we named           |
| `limit`     | a document past one of its [resource budgets](/docs/1.1/limits)             |
| `reference` | a connection to a part or terminal that does not exist                      |
| `topology`  | conflicting nets at one terminal, or a bus width that does not match        |
| `placement` | a relation to nothing, a cycle, a negative distance, or too long a chain    |
| `geometry`  | a part outside the fence, bodies that overlap, or a fit that cannot be made |
| `routing`   | a wire the router could not place, with what to move                        |

Two rules keep the list honest. **A declaration that fails does not cascade.** Its id is set aside, so a mistyped kind on one line does not reappear as "unknown part" on every line that wires to it. **Geometry and routing run only on a document whose declarations are sound**, because a drawing of a document with a broken declaration would be a drawing of something we did not write. References are a different matter. A terminal's name depends on its part's kind, never on where the part sits, so since 1.0.2 a broken relative placement no longer hides a mistyped terminal elsewhere: every connection is still checked.

```schemd bounds="760x440" title="A sound document"
port:ARM "ARM" at (100, 120) #blue
nor:G7 "NOR" right-of ARM by 160 #purple [inputs=2]
port:FIRE "FIRE" right-of G7 by 160 #emerald
clock:TCK "TICK" below G7 by 110 aligned-x with G7 #amber

ARM.out -> G7.in1 #blue [ortho digital]
TCK.out -> G7.in2 #amber [ortho digital]
G7.out1 -> FIRE.in #emerald [ortho digital]
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

A line rewritten by a [sub-circuit](/docs/1.1/subcircuits) parameter carries no column, since its columns would point at text the author never wrote; its line still points at the declaration.

The [playground](/playground/1.1.0) does exactly this as we type: it underlines every reported range, lists the problems beside the source, and keeps the last drawing that compiled on screen, dimmed, until the document is sound again.

```schemd bounds="760x340" title="Live in the playground"
port:PWR "P" at (100, 150) #violet
resistor:RL7 "470 \Omega" right-of PWR by 150 #amber
diode:DL7 "ready" right-of RL7 by 150 #emerald [type=led]

PWR.out -> RL7.in #violet [ortho]
RL7.out -> DL7.anode #amber [ortho]
```

<!-- /schemd-section -->
