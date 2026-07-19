import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegistry, resolveVersion } from '$lib/server/registry';

/** Default workspace program shown before the visitor types or shares. */
const PLAYGROUND_SAMPLE = `// Welcome to the schemd workspace.
// Two declaration shapes; everything else is options.
port:VIN "V_{in}" at (70, 110) #blue
resistor:R1 "10 k\\Omega" at (240, 110) #amber
capacitor:C1 "100 nF" at (410, 110) #cyan
nand:N1 "N1" at (580, 170) #purple
ground:G1 "0 V" at (410, 260) #slate
port:OUT "Q" at (700, 170) #emerald

VIN.out -> R1.in #blue [ortho]
R1.out -> C1.in #amber [ortho]
C1.out -> N1.in1 #cyan [ortho]
C1.out -> G1.in #slate [ortho]
N1.out -> OUT.in #purple [ortho arrow]`;

export const load: PageServerLoad = async ({ params }) => {
	const registry = await getRegistry();
	const version = resolveVersion(registry, params.version);
	if (version === undefined || params.version === 'latest') {
		redirect(307, `/playground/${version ?? registry.latest}`);
	}
	return { version, latest: registry.latest, sample: PLAYGROUND_SAMPLE };
};
