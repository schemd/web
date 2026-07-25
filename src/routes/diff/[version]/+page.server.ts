import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegistry, resolveReleaseVersion, WEBSITE_CORE_VERSION } from '$lib/server/registry';

/** The pair a first-time visitor lands on: one revision of the same filter. */
const BEFORE = `source:VIN "AC" at (100, 140) #blue [type=voltage-ac]
resistor:R1 "1 k\\Omega" at (360, 140) #amber
junction:VOUT "V_{out}" at (600, 140) #cyan
ground:GND "0 V" at (360, 360) #slate

VIN.positive -> R1.in #blue [line]
R1.out -> VOUT.node #amber [line]
VIN.negative -> GND.in #slate [ortho]`;

const AFTER = `source:VIN "AC" at (100, 140) #blue [type=voltage-ac]
resistor:R1 "2 k\\Omega" at (360, 140) #amber
junction:VOUT "V_{out}" at (600, 140) #cyan
capacitor:C1 "100 nF" at (600, 300) #cyan [orientation=down]
ground:GND "0 V" at (360, 360) #slate

VIN.positive -> R1.in #blue [line]
R1.out -> VOUT.node #amber [line]
VOUT.node -> C1.in #cyan [ortho]
VIN.negative -> GND.in #slate [ortho]`;

/**
 * Review a change to a diagram.
 *
 * Both revisions compile in the visitor's browser with the installed engine, so
 * this route ships no compile endpoint of its own and no server state.
 */
export const load: PageServerLoad = async ({ params, url }) => {
	const registry = await getRegistry();
	const version = resolveReleaseVersion(registry, params.version);
	if (version === undefined) {
		error(404, `No release named ${params.version}.`);
	}
	if (params.version !== version) {
		redirect(307, `/diff/${version}${url.search}`);
	}
	return {
		version,
		engineVersion: WEBSITE_CORE_VERSION,
		before: BEFORE,
		after: AFTER
	};
};
