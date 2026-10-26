<!-- schemd-doc: id=framework-adapters; label=Frameworks de interfaz; title=Mantenga el compilador en un límite de confianza del servidor; summary=Renderice una única cadena SVG determinista en Svelte, React, Vue, Angular o un proceso de compilación.; category=Conectar herramientas; order=80 -->

<!-- schemd-section: id=server-boundary; eyebrow=01 / Entorno; title=Compile fuera del estado reactivo del componente; example-title=Framework-neutral source -->

El contrato cabe en una frase: tome el código fuente y una cabecera de bloque validada, llame a `compileSchematic` e inserte el resultado de confianza. El entorno que lo integra nunca debe importar una implementación del DOM ni volver a compilar porque cambie un estado de la interfaz que no guarda relación con el diagrama. El compilador es una función pura del código fuente y de la cabecera del bloque. Tratarlo como tal mantiene bajo el coste del componente.

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
source:CELL4 "3 V" at (80, 130) #blue [type=battery]
resistor:RIND "100 \Omega" at (330, 130) #amber
diode:PWR "power" at (580, 130) #emerald [type=led]
ground:G4 at (580, 260) #slate

CELL4.positive -> RIND.in #blue [ortho]
RIND.out -> PWR.anode #amber [ortho]
PWR.cathode -> G4.in #slate [ortho]
```

En Svelte, el SVG se deriva únicamente del código fuente y de la cabecera del bloque; React memoriza el resultado con esos mismos dos valores, de modo que un nuevo renderizado con entradas idénticas no añade coste. Vue y Angular pasan la cadena por su mecanismo de inserción de HTML de confianza. Ese mecanismo está destinado solo a la salida del compilador. Nunca debe recibir HTML arbitrario del usuario.

<!-- /schemd-section -->
