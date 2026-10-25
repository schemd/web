<!-- schemd-doc: id=markdown-adapters; label=Markdown pipelines; title=Compile only canonical schemd fences; summary=Leave prose parsing to the host and compile bounded schemd blocks with exact diagnostics.; category=Connect toolchains; order=90 -->

<!-- schemd-section: id=fences; eyebrow=01 / Markdown; title=Parse the information string before the body; example-title=Markdown adapter fixture -->

The information string goes to `parseSchematicFence` before the body is touched. When it returns `undefined`, the block belongs to someone else and goes straight back to the host parser. Otherwise the body is compiled and `SchematicSyntaxError.line` is reported. Swallowing a broken example only means shipping it.

```ts
const fence = parseSchematicFence(token.info);
if (!fence) return next(token);
return compileSchematic(token.text, { ...fence, mode: 'default' }).svg;
```

```schemd bounds="780x480" title="Markdown adapter fixture"
source:VY "3.3 V" at (80, 170) #blue [type=voltage-dc orientation=up]
resistor:RTH "NTC 10 k\Omega" at (300, 90) #amber [type=thermistor]
junction:NTC at (500, 90) #cyan
resistor:RBT "10 k\Omega" at (500, 230) #amber [orientation=down]
port:ADC "to ADC" at (680, 90) #emerald
ground:GY "0 V" at (500, 400) #slate

VY.positive -> RTH.in #blue [ortho]
RTH.out -> NTC.node #amber [ortho]
NTC.node -> RBT.in #cyan [ortho]
NTC.node -> ADC.in #emerald [ortho marker-end=arrow]
RBT.out -> GY.in #slate [ortho]
VY.negative -> GY.in #slate [ortho]
```

This site compiles every versioned fence in its own test suite, and that is what keeps a documentation example from being decoration. Each docs line keeps its own examples. Newer syntax is never added to an older line, so the 1.2 pages are the only ones that leave labels out.

<!-- /schemd-section -->
