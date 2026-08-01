<!-- schemd-doc: id=markdown-adapters; label=Markdown pipelines; title=Compile only canonical schemd fences; summary=Leave prose parsing to the host and compile bounded schemd blocks with exact diagnostics.; category=Connect toolchains; order=90 -->

<!-- schemd-section: id=fences; eyebrow=01 / Markdown; title=Parse the information string before the body; example-title=Markdown adapter fixture -->

Hand the information string to `parseSchematicFence` before touching the body. If it returns `undefined`, the block is not ours — give it straight back to the host parser. If it succeeds, compile the body and surface `SchematicSyntaxError.line`, because swallowing a broken example only means shipping it.

```ts
const fence = parseSchematicFence(token.info);
if (!fence) return next(token);
return compileSchematic(token.text, { ...fence, mode: 'default' }).svg;
```

```schemd bounds="760x320" title="Markdown adapter fixture"
source:VM "3.3 V" at (80, 130) #blue [type=voltage-dc]
resistor:RM "10 k\Omega" at (320, 130) #amber
junction:MID "V_{mid}" at (560, 130) #cyan
ground:GM "0 V" at (560, 250) #slate

VM.positive -> RM.in #blue [line]
RM.out -> MID.node #amber [line]
MID.node -> GM.in #slate [ortho]
```

This site compiles every versioned fence in its own test suite, which is what stops a documentation example from being decoration. Each line keeps its own corpus, and newer syntax is never backfilled into an older one.

<!-- /schemd-section -->
