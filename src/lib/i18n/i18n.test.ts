import { describe, expect, it } from 'vitest';
import { localeOf, localized, unlocalized, translator } from './index';
import { isLocale } from './locales';

describe('language routes', () => {
	it('rejects unconfigured locale values', () => {
		for (const value of [null, {}, '__proto__', 'constructor', 'en/us', 'not-a-language'])
			expect(isLocale(value)).toBe(false);
		expect(isLocale('en')).toBe(true);
		expect(isLocale('es')).toBe(true);
	});
	it('preserves source queries and section hashes when changing languages', () => {
		const path = '/playground/1.3.0?code=abc&w=600#preview';
		expect(localized(path, 'es')).toBe('/es' + path);
		expect(localized(localized(path, 'es'), 'en')).toBe(path);
		expect(localized('/es', 'en')).toBe('/');
		expect(unlocalized('/estimate')).toBe('/estimate');
		expect(localeOf('/es/docs/1.3/overview')).toBe('es');
		expect(localeOf('/estimate')).toBe('en');
	});
	it('does not localize APIs, assets, external links or anchors', () => {
		for (const path of [
			'https://example.com',
			'//example.com',
			'/api/compile',
			'/brand/mark.svg',
			'#pins'
		])
			expect(localized(path, 'es')).toBe(path);
	});
});
describe('message formatting', () => {
	const t = translator({
		Pins: 'Pines',
		'Search {0} kinds': 'Buscar entre {0} tipos',
		'Whole number from {0} to {1}': 'Entero entre {0} y {1}'
	});
	it('formats translated messages and numeric parameters', () => {
		expect(t('Pins')).toBe('Pines');
		expect(t('Search {0} kinds', [114])).toBe('Buscar entre 114 tipos');
		expect(t('Whole number from 1 to 16')).toBe('Entero entre 1 y 16');
		expect(t(12)).toBe(12);
	});
	it('rejects inherited message keys and preserves deliberate spacing', () => {
		expect(t('constructor')).toBe('constructor');
		expect(t(' Pins ')).toBe(' Pines ');
		expect(t('untranslated')).toBe('untranslated');
	});
});

describe('mathematical content', () => {
	it('preserves TeX numeric braces in exact messages and unknown prose', () => {
		const math = String.raw`The probability is $\tfrac{1}{8}$.`;
		const exact = translator({ [math]: math });
		expect(exact(math)).toBe(math);
		expect(translator({})(math)).toBe(math);
		expect(exact(' ')).toBe(' ');
	});
	it('preserves the query and hash on the Spanish home page', () => {
		expect(localized('/es?ref=docs#main', 'en')).toBe('/?ref=docs#main');
		expect(localized('/?ref=docs#main', 'es')).toBe('/es?ref=docs#main');
	});
});
