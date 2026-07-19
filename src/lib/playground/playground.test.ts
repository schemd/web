import { describe, expect, it, vi } from 'vitest';
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

	it('round-trips bounded compressed source and supports legacy links', async () => {
		const source = 'port:A "µ" at (1, 2) #blue\n'.repeat(8);
		const query = await encodeSharedSource(source);
		expect(query).toMatch(/^\?code=z1\.[A-Za-z0-9_-]+$/u);
		expect(query.length).toBeLessThan(encodeURIComponent(source).length);
		expect(await decodeSharedSource(query, 300)).toBe(source);
		const shortQuery = await encodeSharedSource('abc');
		expect(await decodeSharedSource(shortQuery, 2)).toBeUndefined();
		expect(await decodeSharedSource('?other=x', 300)).toBeUndefined();
		expect(await decodeSharedSource('plain source', 300)).toBeUndefined();
		expect(await decodeSharedSource('?code=', 300)).toBe('');
		expect(await decodeSharedSource('?code=abc', 2)).toBeUndefined();
		expect(await decodeSharedSource(`?code=${encodeURIComponent(source)}`, 300)).toBe(source);
		expect(await decodeSharedSource(`#source=${encodeURIComponent(source)}`, 300)).toBe(source);
		expect(await decodeSharedSource('#source=%E0%A4%A', 300)).toBeUndefined();
		expect(await decodeSharedSource(query, 2)).toBeUndefined();
		expect(await decodeSharedSource('?code=z1.not*base64', 300)).toBeUndefined();
		expect(await decodeSharedSource('?code=z1.a', 300)).toBeUndefined();
		expect(await decodeSharedSource('?code=z1.YWJj', 300)).toBeUndefined();
		expect(await decodeSharedSource(`?code=z1.${'a'.repeat(2_529)}`, 300)).toBeUndefined();
		const atobSpy = vi.spyOn(globalThis, 'atob').mockImplementation(() => {
			throw new Error('decoder unavailable');
		});
		expect(await decodeSharedSource(query, 300)).toBeUndefined();
		atobSpy.mockRestore();
		await expect(decodeSharedSource(query, 0)).rejects.toThrowError('positive integer');
		await expect(decodeSharedSource(query, 1.2)).rejects.toThrowError('positive integer');
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
