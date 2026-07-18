import {
	compileSchematic,
	parseSchematicFence,
	SchematicSyntaxError,
	type SchematicCompilationMetrics
} from '@schemd/core';

export type VersionCompilerResult =
	| { readonly ok: true; readonly svg: string; readonly metrics: SchematicCompilationMetrics }
	| { readonly ok: false; readonly diagnostic: { readonly message: string; readonly line?: number } };

export function diagnosticFromCompilerError(error: unknown): Extract<VersionCompilerResult, { ok: false }> {
	if (error instanceof SchematicSyntaxError) {
		return {
			ok: false,
			diagnostic: {
				message: error.message,
				...(error.line === undefined ? {} : { line: error.line })
			}
		};
	}
	return { ok: false, diagnostic: { message: 'The compiler failed unexpectedly. Restart the worker and try again.' } };
}

export function compileVersion(source: string, fenceSource: string): VersionCompilerResult {
	try {
		const fence = parseSchematicFence(fenceSource, 'Schemd playground diagram');
		if (!fence) return { ok: false, diagnostic: { message: 'Fence information must begin with schemd.' } };
		const result = compileSchematic(source, { ...fence, mode: 'embedded-css', idPrefix: 'playground-preview' });
		return { ok: true, svg: result.svg, metrics: result.metrics };
	} catch (error) {
		return diagnosticFromCompilerError(error);
	}
}
