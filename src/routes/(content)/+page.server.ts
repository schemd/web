import { compileSchematic, parseSchematicFence } from '@schemd/core';
import { CORE_METRICS, formatBytes } from '$lib/generated/core-metrics';
import { PLAYGROUND_EXAMPLES, fenceInfo } from '$lib/playground/examples';

const umlSource = `class:Compiler "Compiler" at (190, 155) #blue [attributes="- source: string" operations="+ compile(): SVG"]
class:Renderer "SVG renderer" at (565, 155) #emerald [operations="+ render(document): string"]
note:Rule "No DOM required" at (370, 320) #amber [width=190]

Compiler.right -> Renderer.left #emerald [ortho dependency label="emits"]
Rule.top -> Compiler.bottom #amber [ortho dependency]`;

export function load() {
	const heroExample = PLAYGROUND_EXAMPLES[0];
	const heroFence = parseSchematicFence(fenceInfo(heroExample));
	if (!heroFence?.bounds) throw new Error('The canonical landing example must declare bounds.');
	const circuit = compileSchematic(heroExample.source, {
		bounds: heroFence.bounds,
		title: 'Sensor input circuit compiled by Schemd',
		mode: 'embedded-css',
		idPrefix: 'landing-circuit'
	});
	const uml = compileSchematic(umlSource, {
		bounds: { width: 760, height: 410 },
		title: 'Compiler and renderer UML relationship',
		mode: 'embedded-css',
		idPrefix: 'landing-uml'
	});

	return {
		circuitSvg: circuit.svg,
		umlSvg: uml.svg,
		heroSource: heroExample.source,
		heroBounds: heroExample.bounds,
		metrics: {
			version: CORE_METRICS.packageVersion,
			compilerGzip: formatBytes(CORE_METRICS.compilerBundle.gzipBytes),
			npmTarball: formatBytes(CORE_METRICS.npmTarballBytes),
			coverage: `${CORE_METRICS.coverage.statements}%`,
			tests: CORE_METRICS.testCount
		}
	};
}
