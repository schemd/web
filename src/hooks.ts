import type { Reroute } from '@sveltejs/kit/hooks';
import { unlocalized } from '#lib/i18n/index.ts';

/** Both languages share route implementations and retain distinct public URLs. */
export const reroute: Reroute = ({ url }) => unlocalized(url.pathname);
