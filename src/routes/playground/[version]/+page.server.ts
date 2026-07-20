import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRegistry, resolveVersion } from '$lib/server/registry';
import {
	PASSIVE_KINDS,
	ANALOG_KINDS,
	ELECTRICAL_COMPONENT_KINDS,
	CLASSICAL_GATE_KINDS,
	DIGITAL_COMPONENT_KINDS,
	QUANTUM_GATE_KINDS,
	QUANTUM_SPECIAL_KINDS,
	UML_COMPONENT_KINDS,
	COMPONENT_KINDS,
	SCHEMATIC_ORIENTATIONS,
	SEMANTIC_COLORS
} from '@schemd/core';

/**
 * The component vocabulary is read straight from the installed compiler, so the
 * reference panel is always exactly as current as `@schemd/core` — add a
 * primitive upstream and it appears here with no edit to this site.
 */
const KIND_GROUPS = [
	{ label: 'passive', kinds: PASSIVE_KINDS },
	{ label: 'analog', kinds: ANALOG_KINDS },
	{ label: 'electrical', kinds: ELECTRICAL_COMPONENT_KINDS },
	{ label: 'logic', kinds: CLASSICAL_GATE_KINDS },
	{ label: 'digital', kinds: DIGITAL_COMPONENT_KINDS },
	{ label: 'quantum', kinds: QUANTUM_GATE_KINDS },
	{ label: 'quantum systems', kinds: QUANTUM_SPECIAL_KINDS },
	{ label: 'uml', kinds: UML_COMPONENT_KINDS },
	{ label: 'ic', kinds: ['ic'] }
] as const;

/** Default workspace program shown before the visitor types or shares. */
export const _PLAYGROUND_SAMPLE = `// Native first-order RC filter — no UML junction workaround.
source:VIN "V_{in}" at (80, 120) #blue [type=voltage-ac]
resistor:R1 "10 k\\Omega" at (260, 120) #amber
junction:VOUT "output node" at (440, 120) #cyan
capacitor:C1 "100 nF" at (440, 250) #cyan [orientation=down]
ground:GND "0 V" at (440, 350) #slate
port:OUT "V_{out}" at (680, 120) #emerald

VIN.positive -> R1.in #blue [line]
VIN.negative -> GND.in #slate [line]
R1.out -> VOUT.node #amber [line]
VOUT.node -> C1.in #cyan [ortho]
C1.out -> GND.in #cyan [line]
VOUT.node -> OUT.in #emerald [line marker-end=arrow]`;

export const load: PageServerLoad = async ({ params }) => {
	const registry = await getRegistry();
	const version = resolveVersion(registry, params.version);
	if (version === undefined) {
		error(404, `No playground release named ${params.version}.`);
	}
	if (params.version === 'latest') {
		redirect(307, `/playground/${version}`);
	}
	return {
		version,
		latest: registry.latest,
		sample: _PLAYGROUND_SAMPLE,
		kindGroups: KIND_GROUPS.map((group) => ({ label: group.label, kinds: [...group.kinds] })),
		kindCount: COMPONENT_KINDS.length,
		colors: [...SEMANTIC_COLORS],
		orientations: [...SCHEMATIC_ORIENTATIONS]
	};
};
