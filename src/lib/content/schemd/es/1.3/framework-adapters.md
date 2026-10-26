<!-- schemd-doc: id=framework-adapters; label=Frameworks de interfaz; title=Mantenga el compilador en un límite de servidor de confianza; summary=Represente una cadena SVG determinista en Svelte, React, Vue, Angular o un proceso de compilación.; category=Conectar herramientas; order=80 -->

<!-- schemd-section: id=server-boundary; eyebrow=01 / Aplicación anfitriona; title=Compile fuera del estado reactivo del componente; example-title=Framework-neutral source -->

El contrato consiste en recibir el código fuente y una cabecera validada, llamar a `compileSchematic` e insertar el resultado de confianza. La aplicación anfitriona debe prescindir de implementaciones del DOM y de recompilaciones causadas por cambios ajenos al diagrama. El compilador es una función pura del código y la cabecera. Esta propiedad limita el trabajo de cada componente.

```ts
export function renderDiagram(source: string) {
	return compileSchematic(source, {
		bounds: { width: 760, height: 340 },
		title: 'Framework-neutral source',
		mode: 'embedded-css'
	}).svg;
}
```

```schemd bounds="760x340" title="Framework-neutral source"
source:CELL5 "1.5 V" at (80, 130) #blue [type=battery]
resistor:RL5 "68 \Omega" at (330, 130) #amber
diode:RDY "ready" at (580, 130) #emerald [type=led]
ground:G5 at (580, 260) #slate

CELL5.positive -> RL5.in #blue [ortho]
RL5.out -> RDY.anode #amber [ortho]
RDY.cathode -> G5.in #slate [ortho]
```

En Svelte, el SVG se deriva únicamente del código fuente y la cabecera. React memoriza el resultado a partir de esos mismos valores, de modo que una representación con entradas idénticas reutiliza la cadena. Vue y Angular la insertan mediante su mecanismo para HTML de confianza. Ese mecanismo debe recibir únicamente la salida del compilador. El HTML arbitrario de un usuario debe permanecer fuera de él.

<!-- /schemd-section -->
