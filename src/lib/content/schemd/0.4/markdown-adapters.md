<!-- schemd-doc: id=markdown-adapters; label=Markdown pipelines; title=Compile only canonical schemd fences; summary=Leave prose parsing to the host and compile bounded schemd blocks with exact diagnostics.; category=Connect toolchains; order=90 -->

<!-- schemd-section: id=fences; eyebrow=01 / Markdown; title=Parse the information string before the body; example-title=Markdown adapter fixture -->

Pass the information string to `parseSchematicFence`. If it returns `undefined`, leave the code block untouched. If it succeeds, compile the body and surface `SchematicSyntaxError.line` rather than swallowing invalid documentation examples.

```ts
const fence = parseSchematicFence(token.info);
if (!fence) return next(token);
return compileSchematic(token.text, { ...fence, mode: 'default' }).svg;
```

```schemd bounds="760x320" title="Markdown adapter fixture"
source:V "5 V" at (80, 130) #blue [type=voltage-dc]
protection:F "breaker" at (300, 130) #amber [type=breaker]
load:B "buzzer" at (560, 130) #emerald [type=buzzer]
V.positive -> F.in #blue [line]
F.out -> B.in #emerald [line]
```

The official site compiles every versioned fence during server tests. Historical 0.2.1 Markdown remains a separate corpus; 0.3 syntax is never backfilled into old documentation.

<!-- /schemd-section -->
