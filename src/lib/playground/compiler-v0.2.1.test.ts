import { SchematicSyntaxError } from '@schemd/core';
import { describe, expect, it } from 'vitest';
import { compileVersion, diagnosticFromCompilerError } from './compilers/v0.2.1';

describe('v0.2.1 worker compiler adapter', () => {
	it('compiles a valid source with metrics', () => {
		const result = compileVersion(
			'port:A "A" at (80, 80) #blue',
			'schemd bounds="160x160" title="A"'
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.svg).toContain('<svg');
			expect(result.metrics.components).toBe(1);
		}
	});

	it('returns fence and source-positioned syntax diagnostics', () => {
		expect(compileVersion('', 'text').ok).toBe(false);
		const result = compileVersion('not valid', 'schemd bounds="160x160" title="A"');
		expect(result).toEqual({
			ok: false,
			diagnostic: { message: 'Line 1: Unrecognized schematic declaration.', line: 1 }
		});
	});

	it('maps located, unlocated, and unexpected errors', () => {
		expect(diagnosticFromCompilerError(new SchematicSyntaxError('Bad', 4))).toEqual({
			ok: false,
			diagnostic: { message: 'Line 4: Bad', line: 4 }
		});
		expect(diagnosticFromCompilerError(new SchematicSyntaxError('Bad'))).toEqual({
			ok: false,
			diagnostic: { message: 'Bad' }
		});
		expect(diagnosticFromCompilerError(new TypeError('boom')).diagnostic.message).toContain(
			'failed unexpectedly'
		);
	});
});
