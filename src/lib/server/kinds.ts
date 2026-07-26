/**
 * How the compiler's component vocabulary is grouped for readers.
 *
 * `@schemd/core` exports the kind registries; it does not say how to present
 * them. That editorial ordering — passive before analog, quantum systems after
 * quantum gates — was written out three times: once for the coverage report,
 * once for the component catalog, once for the playground's reference panel.
 * Three copies of one taxonomy meant a primitive added upstream could appear in
 * two of the three and be silently missing from the third.
 *
 * The groups are still derived from the compiler's own registries, so adding a
 * primitive upstream still needs no edit here.
 */
import {
	ANALOG_KINDS,
	CLASSICAL_GATE_KINDS,
	DIGITAL_COMPONENT_KINDS,
	ELECTRICAL_COMPONENT_KINDS,
	PASSIVE_KINDS,
	QUANTUM_GATE_KINDS,
	QUANTUM_SPECIAL_KINDS,
	UML_COMPONENT_KINDS
} from '@schemd/core';

/** One presented category and the kinds it contains. */
export interface KindGroup {
	readonly label: string;
	readonly kinds: readonly string[];
}

/** The presentation order every surface shares. */
export const KIND_GROUPS: readonly KindGroup[] = [
	{ label: 'passive', kinds: PASSIVE_KINDS },
	{ label: 'analog', kinds: ANALOG_KINDS },
	{ label: 'electrical', kinds: ELECTRICAL_COMPONENT_KINDS },
	{ label: 'logic', kinds: CLASSICAL_GATE_KINDS },
	{ label: 'digital', kinds: DIGITAL_COMPONENT_KINDS },
	{ label: 'quantum', kinds: QUANTUM_GATE_KINDS },
	{ label: 'quantum systems', kinds: QUANTUM_SPECIAL_KINDS },
	{ label: 'uml', kinds: UML_COMPONENT_KINDS },
	{ label: 'ic', kinds: ['ic'] }
];

const GROUP_BY_KIND = new Map<string, string>();
for (const group of KIND_GROUPS) {
	for (const kind of group.kinds) GROUP_BY_KIND.set(kind, group.label);
}

/** Category label for a kind, or `undefined` if the registries never claim it. */
export function groupOfKind(kind: string): string | undefined {
	return GROUP_BY_KIND.get(kind);
}

/** Plain, serializable copy for a `load` payload. */
export function serializableKindGroups(): { label: string; kinds: string[] }[] {
	return KIND_GROUPS.map((group) => ({ label: group.label, kinds: [...group.kinds] }));
}
