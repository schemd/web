import { getContext, setContext } from 'svelte';
import { messageKey } from './message-key';

export type Locale = 'en' | 'es';
export type Messages = Readonly<Record<string, string>>;
export interface LanguageData {
	locale: Locale;
	messages: Messages;
}
const CONTEXT = Symbol('schemd.language');

export function localeOf(pathname: string): Locale {
	return /^\/es(?:\/|$)/.test(pathname) ? 'es' : 'en';
}
export function unlocalized(pathname: string): string {
	const bare = pathname.replace(/^\/es(?=\/|[?#]|$)/, '') || '/';
	return /^[?#]/.test(bare) ? '/' + bare : bare;
}
export function localized(path: string, locale: Locale): string {
	if (
		!path.startsWith('/') ||
		path.startsWith('//') ||
		/^\/(?:api|brand|favicon|locale|embed)(?:\/|\.|$)/.test(path)
	)
		return path;
	const bare = unlocalized(path);
	return locale === 'es'
		? `/es${bare === '/' ? '' : bare.startsWith('/?') || bare.startsWith('/#') ? bare.slice(1) : bare}`
		: bare;
}

/** Message formatting is shared by SSR and hydration; source code never enters it. */
export function translator(messages: Messages) {
	let patterns: { expression: RegExp; value: string }[] | undefined;
	return function translate<T>(
		input: T,
		values?: readonly unknown[]
	): T extends string ? string : T {
		if (typeof input !== 'string') return input as T extends string ? string : T;
		const normalized = input.replace(/\s+/g, ' ').trim();
		if (!normalized) return input as T extends string ? string : T;
		const key = Object.hasOwn(messages, normalized) ? normalized : messageKey(normalized);
		const found = Object.hasOwn(messages, key);
		let result = found ? messages[key]! : normalized;
		if (!found && values === undefined && Object.keys(messages).length) {
			patterns ??= Object.entries(messages)
				.filter(([key]) => key.includes('{0}'))
				.map(([key, value]) => ({
					expression: new RegExp(
						'^' +
							key
								.split(/\{\d+\}/)
								.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
								.join('(.+?)') +
							'$'
					),
					value
				}));
			for (const pattern of patterns) {
				const match = pattern.expression.exec(normalized);
				if (match) {
					result = pattern.value.replace(
						/\{(\d+)\}/g,
						(placeholder, index: string) => match[Number(index) + 1] ?? placeholder
					);
					break;
				}
			}
		}
		if (values)
			result = result.replace(/\{(\d+)\}/g, (placeholder, index: string) =>
				Number(index) < values.length ? String(values[Number(index)] ?? '') : placeholder
			);
		return ((input.match(/^\s*/)?.[0] ?? '') +
			result +
			(input.match(/\s*$/)?.[0] ?? '')) as T extends string ? string : T;
	};
}

export function provideLanguage(data: () => LanguageData) {
	let previous: Messages | undefined;
	let translate = translator({});
	const language = {
		locale: () => data().locale,
		t: <T>(input: T, values?: readonly unknown[]) => {
			if (previous !== data().messages) {
				previous = data().messages;
				translate = translator(previous);
			}
			return translate(input, values);
		},
		href: (path: string) => localized(path, data().locale)
	};
	setContext(CONTEXT, language);
	return language;
}
export function useLanguage(): ReturnType<typeof provideLanguage> {
	return (
		getContext(CONTEXT) ?? { locale: () => 'en', t: translator({}), href: (path: string) => path }
	);
}
