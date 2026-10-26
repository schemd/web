import en from './messages.en.json';
import es from './messages.es.json';
import { messageKey } from '#lib/i18n/message-key.ts';
import { unlocalized, type Locale, type Messages } from '#lib/i18n/index.ts';

const catalog = new Map<string, Messages>();
const sections = new Set(Object.values(en).flat());
/** Catalogs are serialized once per layout navigation, for the selected locale and section. */
export function messagesFor(pathname: string, locale: Locale): Messages {
	const requested = unlocalized(pathname).split('/')[1] || 'home';
	const section = sections.has(requested) ? requested : 'home';
	const cacheKey = `${locale}:${section}`;
	const cached = catalog.get(cacheKey);
	if (cached) return cached;
	const result: Record<string, string> = Object.create(null);
	for (const [source, groups] of Object.entries(en)) {
		if (!groups.includes('global') && !groups.includes(section)) continue;
		const translation =
			locale === 'es' && Object.hasOwn(es, source)
				? (es as Record<string, string>)[source]!
				: source;
		result[messageKey(source)] = translation;
		if (/\{\d+\}/.test(source)) result[source] = translation;
	}
	catalog.set(cacheKey, result);
	return result;
}
