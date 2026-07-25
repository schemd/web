import { describe, expect, it } from 'vitest';
import { buildNetlist, parseSchematic, parseSchematicFence } from '@schemd/core';
import { diffNetlists } from './diagram-diff';

const fence = parseSchematicFence('schemd bounds="1000x600" title="Diff fixture"')!;
const netlist = (source: string) => buildNetlist(parseSchematic(source, fence));

const BASE = `source:V1 "AC" at (100, 150) #blue [type=voltage-ac]
resistor:R1 "1 k" at (360, 150) #amber
ground:GND "0 V" at (620, 150) #slate

V1.positive -> R1.in #blue [line]
R1.out -> GND.in #slate [line]`;

const kinds = (before: string, after: string) =>
	diffNetlists(netlist(before), netlist(after)).changes.map((change) => change.kind);

describe('diffNetlists', () => {
	it('reports no changes for an identical document', () => {
		const delta = diffNetlists(netlist(BASE), netlist(BASE));
		expect(delta.identical).toBe(true);
		expect(delta.changes).toEqual([]);
		expect(delta.counts).toEqual({ components: 0, nets: 0, connections: 0 });
	});

	it('ignores pure whitespace and ordering differences', () => {
		const reordered = `resistor:R1 "1 k" at (360, 150) #amber
source:V1 "AC" at (100, 150) #blue [type=voltage-ac]
ground:GND "0 V" at (620, 150) #slate

R1.out -> GND.in #slate [line]
V1.positive -> R1.in #blue [line]`;
		expect(diffNetlists(netlist(BASE), netlist(reordered)).identical).toBe(true);
	});

	it('names an added component and the connection that reaches it', () => {
		const after = `${BASE}
capacitor:C1 "100 nF" at (360, 380) #cyan [orientation=down]
R1.out -> C1.in #cyan [ortho]`;
		const delta = diffNetlists(netlist(BASE), netlist(after));
		expect(delta.changes[0]).toMatchObject({
			kind: 'component-added',
			subject: 'C1',
			summary: 'C1 (capacitor) added'
		});
		expect(delta.changes.map((change) => change.kind)).toContain('connection-added');
		expect(delta.counts.components).toBe(1);
	});

	it('reports a removed component', () => {
		const after = `source:V1 "AC" at (100, 150) #blue [type=voltage-ac]
resistor:R1 "1 k" at (360, 150) #amber

V1.positive -> R1.in #blue [line]`;
		const delta = diffNetlists(netlist(BASE), netlist(after));
		expect(delta.changes[0]).toMatchObject({ kind: 'component-removed', subject: 'GND' });
	});

	it('separates a move from a relabel from a retype', () => {
		const moved = BASE.replace('at (360, 150)', 'at (360, 300)');
		expect(kinds(BASE, moved)).toContain('component-moved');
		expect(diffNetlists(netlist(BASE), netlist(moved)).changes[0]?.details[0]).toBe(
			'(360, 150) → (360, 300)'
		);

		const relabelled = BASE.replace('"1 k"', '"2 k"');
		expect(kinds(BASE, relabelled)).toEqual(['component-relabelled']);

		const retyped = BASE.replace('resistor:R1', 'inductor:R1');
		expect(kinds(BASE, retyped)).toContain('component-retyped');
	});

	it('reports terminals a named net gained', () => {
		const before = `port:A "A" at (100, 150) #blue
port:B "B" at (400, 150) #blue
A.out -> B.in #blue [line net=bus]`;
		const after = `port:A "A" at (100, 150) #blue
port:B "B" at (400, 150) #blue
port:C "C" at (700, 150) #blue
A.out -> B.in #blue [line net=bus]
B.out -> C.in #blue [line net=bus]`;
		const delta = diffNetlists(netlist(before), netlist(after));
		const netChange = delta.changes.find((change) => change.kind === 'net-terminals-changed');
		expect(netChange?.subject).toBe('bus');
		expect(netChange?.details[0]).toContain('gained');
		expect(netChange?.details[0]).toContain('C.in');
	});

	it('reports a rerouted connection as one removal and one addition', () => {
		const after = BASE.replace(
			'R1.out -> GND.in #slate [line]',
			'V1.negative -> GND.in #slate [ortho]'
		);
		const delta = diffNetlists(netlist(BASE), netlist(after));
		const kindsFound = delta.changes.map((change) => change.kind);
		expect(kindsFound).toContain('connection-removed');
		expect(kindsFound).toContain('connection-added');
		expect(delta.counts.connections).toBe(2);
	});

	it('treats a connection declared in the other direction as unchanged', () => {
		const flipped = BASE.replace('V1.positive -> R1.in', 'R1.in -> V1.positive');
		const delta = diffNetlists(netlist(BASE), netlist(flipped));
		expect(delta.changes.map((change) => change.kind)).not.toContain('connection-removed');
	});

	it('orders changes by kind, then subject, for a stable review', () => {
		const after = `source:V1 "AC" at (100, 150) #blue [type=voltage-ac]
resistor:R1 "2 k" at (360, 300) #amber
capacitor:C1 "100 nF" at (620, 380) #cyan

V1.positive -> R1.in #blue [line]
R1.out -> C1.in #cyan [ortho]`;
		const delta = diffNetlists(netlist(BASE), netlist(after));
		const order = delta.changes.map((change) => change.kind);
		expect(order.indexOf('component-removed')).toBeLessThan(order.indexOf('component-added'));
		expect(order.indexOf('component-added')).toBeLessThan(order.indexOf('component-moved'));
		expect(order.lastIndexOf('connection-added')).toBe(order.length - 1);
	});

	it('handles an empty document on either side', () => {
		const empty = buildNetlist({ components: [], connections: [] });
		expect(diffNetlists(empty, netlist(BASE)).counts.components).toBe(3);
		expect(diffNetlists(netlist(BASE), empty).counts.components).toBe(3);
		expect(diffNetlists(empty, empty).identical).toBe(true);
	});
});
