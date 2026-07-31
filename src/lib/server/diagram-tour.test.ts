/**
 * The tour is a pure function of the document, so everything worth asserting
 * about it can be asserted without a browser: that each sentence is attached to
 * the net it actually describes, that the highlight targets exist in the
 * compiled markup, and that two runs agree.
 */
import { describe, expect, test } from 'vitest';
import { buildNetlist, compileSchematic, parseSchematic } from '@schemd/core';
import { buildDiagramTour } from './diagram-tour';

const fence = { bounds: { width: 900, height: 520 }, title: 'Tour fixture' } as const;

const RC_FILTER = `source:VIN "AC" at (110, 150) #blue [type=voltage-ac]
resistor:R1 "1 kΩ" at (330, 150) #amber
junction:VOUT "V_{out}" at (560, 150) #cyan
capacitor:C1 "100 nF" at (560, 320) #cyan [orientation=down]
ground:GND "0 V" at (330, 430) #slate

VIN.positive -> R1.in #blue [line]
R1.out -> VOUT.node #amber [line]
VOUT.node -> C1.in #cyan [ortho]
C1.out -> GND.in #slate [ortho]`;

const tourFor = (source: string) => buildDiagramTour(parseSchematic(source, fence));

describe('the sequence', () => {
	test('opens with the summary the netlist derived', () => {
		const tour = tourFor(RC_FILTER);
		expect(tour.headline).toMatch(/\S/);
		expect(tour.inventory).toMatch(/resistor|capacitor|source/i);
	});

	test('gives one stop per net, in net order', () => {
		const document = parseSchematic(RC_FILTER, fence);
		const nets = buildNetlist(document).nets;
		const tour = buildDiagramTour(document);
		expect(tour.stops.map((stop) => stop.netId)).toEqual(nets.map((net) => net.id));
	});

	test('attaches each sentence to the net it describes', () => {
		/* The pairing is by index, which only holds while `describeNetlist` writes
		   one sentence per net. If that ever changes, this is what catches it: a
		   stop naming a component its sentence never mentions. */
		const tour = tourFor(RC_FILTER);
		for (const stop of tour.stops) {
			const named = stop.nodes.filter((node) => stop.text.includes(node));
			expect(named.length, `${stop.netId}: "${stop.text}"`).toBeGreaterThan(0);
		}
	});

	test('lists every component on a net, without repeats', () => {
		const tour = tourFor(RC_FILTER);
		const vinNet = tour.stops.find((stop) => stop.nodes.includes('VIN'))!;
		expect(vinNet.nodes).toContain('R1');
		expect(new Set(vinNet.nodes).size).toBe(vinNet.nodes.length);
	});

	test('carries the source lines a host can move a caret to', () => {
		const tour = tourFor(RC_FILTER);
		for (const stop of tour.stops) {
			expect(stop.lines.length).toBeGreaterThan(0);
			for (const line of stop.lines) expect(line).toBeGreaterThan(0);
		}
	});

	test('reports an author net name when the source declared one', () => {
		const named = `port:A "A" at (140, 200) #blue\nport:B "B" at (620, 200) #emerald\nA.out -> B.in #blue [line net=SUPPLY]`;
		const [stop] = tourFor(named).stops;
		expect(stop!.name).toBe('SUPPLY');
		/* An inferred net has no author name to show, so the host falls back to the
		   identifier rather than inventing one. */
		expect(tourFor(RC_FILTER).stops[0]!.name).toBeUndefined();
	});

	test('keeps a net that goes nowhere rather than hiding it', () => {
		/* A dangling net is precisely what a reader who cannot see the diagram most
		   needs told, and the design rules already treat it as a finding. */
		const dangling = `port:A "A" at (140, 200) #blue\nport:B "B" at (620, 200) #emerald\nresistor:R9 "R" at (380, 400) #amber\nA.out -> B.in #blue [line]`;
		const tour = tourFor(dangling);
		expect(tour.stops.length).toBeGreaterThan(0);
		expect(tour.inventory).toContain('resistor');
	});

	test('is identical across runs', () => {
		const document = parseSchematic(RC_FILTER, fence);
		expect(JSON.stringify(buildDiagramTour(document))).toBe(
			JSON.stringify(buildDiagramTour(document))
		);
	});
});

describe('agreement with the markup', () => {
	test('every highlight target exists in the compiled SVG', () => {
		/* The whole feature rests on this: a node id the tour names but the markup
		   never stamps would light nothing, silently. */
		const compilation = compileSchematic(RC_FILTER, { ...fence, mode: 'full' });
		const tour = buildDiagramTour(compilation.document);
		const drawn = new Set(
			[...compilation.svg.matchAll(/data-node-id="([^"]+)"/g)].map((match) => match[1]!)
		);
		for (const stop of tour.stops) {
			for (const node of stop.nodes) expect(drawn, `node ${node}`).toContain(node);
		}
	});

	test('every net the tour walks is addressable in the markup', () => {
		const compilation = compileSchematic(RC_FILTER, { ...fence, mode: 'full' });
		const tour = buildDiagramTour(compilation.document);
		const nets = new Set(
			[...compilation.svg.matchAll(/data-net-id="([^"]+)"/g)].map((match) => match[1]!)
		);
		for (const stop of tour.stops) expect(nets, `net ${stop.netId}`).toContain(stop.netId);
	});
});
