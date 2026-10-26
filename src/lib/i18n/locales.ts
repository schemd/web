/** Enable a language here once its translations are available. Names are autonyms. */
export const LANGUAGES = [
	{ code: 'en', name: 'English' },
	{ code: 'es', name: 'Español' }
] as const;

export type Locale = (typeof LANGUAGES)[number]['code'];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
	return LANGUAGES.some((language) => language.code === value);
}
