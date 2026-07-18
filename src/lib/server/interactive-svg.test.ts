import { describe, expect, it } from 'vitest';
import { exposeInteractiveSvg } from './interactive-svg';

describe('interactive SVG semantics', () => {
	it('promotes the compiler root to a labelled group', () => {
		expect(
			exposeInteractiveSvg(
				'<figure><svg role="img" aria-labelledby="title"><title id="title">Circuit</title><circle role="button"/></svg></figure>'
			)
		).toBe(
			'<figure><svg role="group" aria-labelledby="title"><title id="title">Circuit</title><circle role="button"/></svg></figure>'
		);
	});

	it('rejects malformed or incompatible compiler output', () => {
		expect(() => exposeInteractiveSvg('<figure></figure>')).toThrowError('SVG root');
		expect(() => exposeInteractiveSvg('<svg role="img"')).toThrowError('opening tag terminator');
		expect(() => exposeInteractiveSvg('<svg><g role="img"></g></svg>')).toThrowError(
			'root must expose'
		);
		expect(() => exposeInteractiveSvg('<svg role="group"></svg>')).toThrowError('root must expose');
	});
});
