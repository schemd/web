import { describe, expect, it } from 'vitest';
import { acceptsCompilation, createCoordinatorState, nextCompilation } from './coordinator';
import { fenceInfo, getPlaygroundExample, PLAYGROUND_EXAMPLES } from './examples';
import {
	isCompilerWorkerRequest,
	isCompilerWorkerResponse,
	type CompilerWorkerResponse
} from './protocol';
import { decodeSharedSource, encodeSharedSource, svgFileName } from './share';

describe('playground state and protocol', () => {
	it('issues monotonic requests, skips duplicate source, and rejects stale responses', () => {
		const empty = createCoordinatorState();
		const first = nextCompilation(empty, 'a');
		expect(first?.requestId).toBe(1);
		if (!first) throw new Error('Expected first request.');
		expect(nextCompilation(first.state, 'a')).toBeUndefined();
		const second = nextCompilation(first.state, 'b');
		if (!second) throw new Error('Expected second request.');
		const stale: CompilerWorkerResponse = { kind: 'error', id: 1, diagnostic: { message: 'old' } };
		const current: CompilerWorkerResponse = {
			kind: 'success',
			id: 2,
			svg: '<svg/>',
			metrics: { sourceCharacters: 1, components: 1, connections: 0, svgBytes: 6 }
		};
		expect(acceptsCompilation(second.state, stale)).toBe(false);
		expect(acceptsCompilation(second.state, current)).toBe(true);
		expect(acceptsCompilation(second.state, { kind: 'ready' })).toBe(false);
	});

	it.each([
		[{ kind: 'ready' }, true],
		[
			{
				kind: 'success',
				id: 1,
				svg: '<svg/>',
				metrics: { sourceCharacters: 1, components: 1, connections: 0, svgBytes: 6 }
			},
			true
		],
		[{ kind: 'error', id: 1, diagnostic: { message: 'bad', line: 2 } }, true],
		[{ kind: 'error', id: 1, diagnostic: { message: 'bad' } }, true],
		[null, false],
		[{}, false],
		[{ kind: 2 }, false],
		[{ kind: 'other', id: 1 }, false],
		[{ kind: 'success', id: '1', svg: '', metrics: {} }, false],
		[{ kind: 'success', id: 1, svg: 2, metrics: {} }, false],
		[{ kind: 'success', id: 1, svg: '', metrics: { sourceCharacters: 1 } }, false],
		[{ kind: 'error', id: 1, diagnostic: null }, false],
		[{ kind: 'error', id: 1, diagnostic: { message: 2 } }, false],
		[{ kind: 'error', id: 1, diagnostic: { message: 'bad', line: '2' } }, false]
	] as const)('validates worker message %#', (value, expected) => {
		expect(isCompilerWorkerResponse(value)).toBe(expected);
	});

	it('validates worker compile requests', () => {
		const valid = { kind: 'compile', id: 1, version: 'v0.2.1', source: 'x', fence: 'schemd' };
		expect(isCompilerWorkerRequest(valid)).toBe(true);
		for (const invalid of [
			null,
			{},
			{ ...valid, kind: 'other' },
			{ ...valid, id: '1' },
			{ ...valid, version: 'v9' },
			{ ...valid, source: 1 },
			{ ...valid, fence: 1 }
		]) {
			expect(isCompilerWorkerRequest(invalid)).toBe(false);
		}
	});

	it('round-trips bounded shared source and rejects bad hashes', () => {
		const source = 'port:A "µ" at (1, 2) #blue';
		const hash = encodeSharedSource(source);
		expect(decodeSharedSource(hash, 100)).toBe(source);
		expect(decodeSharedSource('?other=x', 100)).toBeUndefined();
		expect(decodeSharedSource('plain source', 100)).toBeUndefined();
		expect(decodeSharedSource('?code=', 100)).toBe('');
		expect(decodeSharedSource(`#source=${encodeURIComponent(source)}`, 100)).toBe(source);
		expect(decodeSharedSource('#source=%E0%A4%A', 100)).toBeUndefined();
		expect(decodeSharedSource(hash, 2)).toBeUndefined();
		expect(() => decodeSharedSource(hash, 0)).toThrowError('positive integer');
		expect(() => decodeSharedSource(hash, 1.2)).toThrowError('positive integer');
	});

	it('creates portable SVG file names', () => {
		expect(svgFileName(' Sensor Input / ADC ')).toBe('sensor-input-adc.svg');
		expect(svgFileName('***')).toBe('schemd-diagram.svg');
		expect(svgFileName('a'.repeat(90))).toBe(`${'a'.repeat(64)}.svg`);
	});

	it('resolves curated examples and their fence information', () => {
		expect(PLAYGROUND_EXAMPLES).toHaveLength(4);
		const example = getPlaygroundExample('uml-order');
		expect(example?.source).toContain('class:Order');
		if (!example) throw new Error('Expected UML example.');
		expect(fenceInfo(example)).toBe('schemd bounds="960x480" title="Order model"');
		expect(getPlaygroundExample('missing')).toBeUndefined();
	});
});
