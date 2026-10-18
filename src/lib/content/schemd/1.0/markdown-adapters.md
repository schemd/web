<!-- schemd-doc: id=markdown-adapters; label=Markdown pipelines; title=Compile only canonical schemd fences; summary=Leave prose parsing to the host and compile bounded schemd blocks with exact diagnostics.; category=Connect toolchains; order=90 -->

<!-- schemd-section: id=fences; eyebrow=01 / Markdown; title=Parse the information string before the body; example-title=Markdown adapter fixture -->

Hand the information string to `parseSchematicFence` before touching the body. If it returns `undefined`, the block is not ours — give it straight back to the host parser. If it succeeds, compile the body and surface `SchematicSyntaxError.line`, because swallowing a broken example only means shipping it.

```ts
const fence = parseSchematicFence(token.info);
if (!fence) return next(token);
return compileSchematic(token.text, { ...fence, mode: 'default' }).svg;
```

```schemd bounds="760x340" title="Markdown adapter fixture"
source:VR "2.5 V" at (80, 130) #blue [type=voltage-dc]
resistor:RT "10 k\Omega" at (320, 130) #amber [type=thermistor]
junction:SNS "V_{ntc}" at (560, 130) #cyan
ground:GR "0 V" at (560, 260) #slate

VR.positive -> RT.in #blue [ortho]
RT.out -> SNS.node #amber [ortho]
SNS.node -> GR.in #slate [ortho]
```

This site compiles every versioned fence in its own test suite, which is what stops a documentation example from being decoration. Each line keeps its own corpus, and newer syntax is never backfilled into an older one.

<!-- /schemd-section -->
