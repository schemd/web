<!-- schemd-doc: id=markdown-adapters; label=Markdown pipelines; title=Compile only canonical schemd fences; summary=Leave prose parsing to the host and compile bounded schemd blocks with exact diagnostics.; category=Connect toolchains; order=90 -->

<!-- schemd-section: id=fences; eyebrow=01 / Markdown; title=Parse the information string before the body; example-title=Markdown adapter fixture -->

Hand the information string to `parseSchematicFence` first. If it returns `undefined`, the block is not ours — give it straight back to the host parser. If it succeeds, compile the body and surface `SchematicSyntaxError.line`; swallowing a broken example only means shipping it.

```ts
const fence = parseSchematicFence(token.info);
if (!fence) return next(token);
return compileSchematic(token.text, { ...fence, mode: 'default' }).svg;
```

```schemd bounds="800x340" title="Markdown adapter fixture"
source:V "3.3 V" at (90, 150) #blue [type=voltage-dc]
switch:SW "arm" at (330, 150) #amber [type=pushbutton]
load:BUZ "sounder" at (620, 150) #emerald [type=buzzer]

V.positive -> SW.in #blue [line]
SW.out -> BUZ.in #emerald [line marker-end=arrow]
```

This site compiles every versioned fence during its own tests, which is how a documentation example stops being decoration. The historical 0.2.x corpus stays separate — 0.3 syntax is never backfilled into it.

<!-- /schemd-section -->
