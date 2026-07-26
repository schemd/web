import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegistry, resolveReleaseVersion, WEBSITE_CORE_VERSION } from '$lib/server/registry';
import { COMPONENT_KINDS, SCHEMATIC_ORIENTATIONS, SEMANTIC_COLORS } from '@schemd/core';
import { RC_FILTER_SOURCE } from '$lib/diagrams';
/*
 * The component vocabulary and its grouping are read straight from the
 * installed compiler via one shared catalogue, so the reference panel is always
 * exactly as current as `@schemd/core` and always agrees with `/coverage`.
 */
import { serializableKindGroups } from '$lib/server/kinds';

/** Default workspace program shown before the visitor types or shares. */
export const _PLAYGROUND_SAMPLE = RC_FILTER_SOURCE;

export const load: PageServerLoad = async ({ params, url }) => {
	const registry = await getRegistry();
	const version = resolveReleaseVersion(registry, params.version);
	if (version === undefined) {
		error(404, `No playground release named ${params.version}.`);
	}
	/* Canonicalize aliases (`latest`, `0.3`) to the concrete release URL,
	 * preserving `?code=`/bounds so an opened example survives the hop. */
	if (params.version !== version) {
		redirect(307, `/playground/${version}${url.search}`);
	}
	return {
		version,
		latest: registry.latest,
		/**
		 * The one engine this deployment can actually execute. The playground
		 * compiles every keystroke with the installed `@schemd/core`; it never
		 * re-runs a historical release. Surfacing this lets the toolbar tell the
		 * truth when the visitor is *viewing* an older version.
		 */
		engineVersion: WEBSITE_CORE_VERSION,
		sample: _PLAYGROUND_SAMPLE,
		kindGroups: serializableKindGroups(),
		kindCount: COMPONENT_KINDS.length,
		colors: [...SEMANTIC_COLORS],
		orientations: [...SCHEMATIC_ORIENTATIONS]
	};
};
