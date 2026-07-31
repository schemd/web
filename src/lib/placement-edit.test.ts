/**
 * The rewrite is surgical or it is worthless.
 *
 * The property the whole feature rests on is that nothing except the numbers
 * changes — so the central test asserts it across every component kind rather
 * than on three hand-picked lines, and the results are fed back through the real
 * compiler to prove the output is still a valid document.
 */
import { describe, expect, test } from 'vitest';
import { compileSchematic, parseSchematic } from '@schemd/core';
import {
	HORIZONTAL_GAP,
	SNAP_GRID,
	VERTICAL_GAP,
	freezeToAbsolute,
	moveDeclaration,
	snapToGrid
} from './placement-edit';

const fence = { bounds: { width: 900, height: 560 }, title: 'Edit fixture' } as const;

describe('snapping', () => {
	test('settles on the grid the playground advertises', () => {
		expect(SNAP_GRID).toBe(10);
		expect(snapToGrid(147)).toBe(150);
		expect(snapToGrid(142)).toBe(140);
		expect(snapToGrid(-3)).toBe(-0);
	});

	test('leaves a value alone when the grid is meaningless', () => {
		expect(snapToGrid(147, 0)).toBe(147);
		expect(snapToGrid(Number.NaN)).toBeNaN();
	});
});

describe('moving an absolute declaration', () => {
	test('rewrites only the coordinates', () => {
		const source = 'resistor:R1 "1 kΩ" at (330, 150) #amber [type=thermistor] // keep me';
		const edit = moveDeclaration(source, 1, { x: 400, y: 220 }, { x: 330, y: 150 });
		expect(edit).toMatchObject({ kind: 'absolute', x: 400, y: 220 });
		expect(edit.kind === 'absolute' && edit.text).toBe(
			'resistor:R1 "1 kΩ" at (400, 220) #amber [type=thermistor] // keep me'
		);
	});

	test("preserves the author's own spacing inside the parentheses", () => {
		const tight = moveDeclaration(
			'port:A "A" at(90,150) #blue',
			1,
			{ x: 120, y: 160 },
			{ x: 90, y: 150 }
		);
		expect(tight.kind === 'absolute' && tight.text).toBe('port:A "A" at(120,160) #blue');
		const loose = moveDeclaration(
			'port:A "A" at (  90 ,  150 ) #blue',
			1,
			{ x: 120, y: 160 },
			{ x: 90, y: 150 }
		);
		expect(loose.kind === 'absolute' && loose.text).toBe('port:A "A" at (  120 ,  160 ) #blue');
	});

	test('snaps to the grid so the number is one an author would type', () => {
		const edit = moveDeclaration(
			'port:A "A" at (90, 150) #blue',
			1,
			{ x: 143.7, y: 218.2 },
			{ x: 90, y: 150 }
		);
		expect(edit).toMatchObject({ x: 140, y: 220 });
	});

	test('touches no other line', () => {
		const source = ['port:A "A" at (90, 150) #blue', 'port:B "B" at (400, 150) #emerald'].join(
			'\n'
		);
		const edit = moveDeclaration(source, 2, { x: 500, y: 300 }, { x: 400, y: 150 });
		expect(edit.kind === 'absolute' && edit.text.split('\n')[0]).toBe(
			'port:A "A" at (90, 150) #blue'
		);
	});
});

describe('moving a relative declaration', () => {
	test('rewrites the distance, not the relationship', () => {
		const source = 'resistor:R1 "R" right-of VIN by 190 #amber [orientation=up]';
		const edit = moveDeclaration(source, 1, { x: 400, y: 150 }, { x: 330, y: 150 });
		expect(edit).toMatchObject({ kind: 'relative', gap: 260 });
		expect(edit.kind === 'relative' && edit.text).toBe(
			'resistor:R1 "R" right-of VIN by 260 #amber [orientation=up]'
		);
	});

	test('writes a distance where the declaration relied on the default', () => {
		const edit = moveDeclaration(
			'resistor:R1 "R" right-of VIN #amber',
			1,
			{ x: 400, y: 150 },
			{ x: 330, y: 150 }
		);
		expect(edit).toMatchObject({ kind: 'relative', gap: HORIZONTAL_GAP + 70 });
		expect(edit.kind === 'relative' && edit.text).toBe(
			'resistor:R1 "R" right-of VIN by 230 #amber'
		);
	});

	test('uses the vertical default for a vertical relation', () => {
		const edit = moveDeclaration(
			'resistor:R1 "R" below VIN #amber',
			1,
			{ x: 0, y: 200 },
			{ x: 0, y: 150 }
		);
		expect(edit).toMatchObject({ gap: VERTICAL_GAP + 50 });
	});

	test('inverts the delta for a relation that measures the other way', () => {
		/* Dragging left moves R1 *away* from a reference on its right, so the gap
		   grows. Getting this backwards would make the part chase the pointer. */
		const edit = moveDeclaration(
			'resistor:R1 "R" left-of VIN by 100 #amber',
			1,
			{ x: 260, y: 150 },
			{ x: 330, y: 150 }
		);
		expect(edit).toMatchObject({ gap: 170 });
		const above = moveDeclaration(
			'resistor:R1 "R" above VIN by 100 #amber',
			1,
			{ x: 0, y: 80 },
			{ x: 0, y: 150 }
		);
		expect(above).toMatchObject({ gap: 170 });
	});

	test('never writes a negative distance', () => {
		/* The compiler rejects one, so producing it would turn a drag into a
		   compile error rather than a move. */
		const edit = moveDeclaration(
			'resistor:R1 "R" right-of VIN by 40 #amber',
			1,
			{ x: 100, y: 150 },
			{ x: 330, y: 150 }
		);
		expect(edit).toMatchObject({ gap: 0 });
	});

	test('keeps the trailing relations intact', () => {
		const source =
			'capacitor:C1 "100 nF" below VOUT by 110 aligned-x with VOUT #cyan [orientation=down]';
		const edit = moveDeclaration(source, 1, { x: 560, y: 360 }, { x: 560, y: 320 });
		expect(edit.kind === 'relative' && edit.text).toBe(
			'capacitor:C1 "100 nF" below VOUT by 150 aligned-x with VOUT #cyan [orientation=down]'
		);
	});

	test('declines a declaration that is only aligned', () => {
		const edit = moveDeclaration(
			'port:A "A" aligned-x with VIN #blue',
			1,
			{ x: 200, y: 0 },
			{ x: 100, y: 0 }
		);
		expect(edit).toMatchObject({ kind: 'unsupported' });
		expect(edit.kind === 'unsupported' && edit.reason).toMatch(/only aligned/);
	});

	test('declines a line it cannot read, and a line that is not there', () => {
		expect(moveDeclaration('// a comment', 1, { x: 1, y: 1 }, { x: 0, y: 0 })).toMatchObject({
			kind: 'unsupported'
		});
		expect(
			moveDeclaration('port:A "A" at (1, 1) #blue', 9, { x: 1, y: 1 }, { x: 0, y: 0 })
		).toMatchObject({
			kind: 'unsupported'
		});
	});
});

describe('the rest of the line survives', () => {
	/* Across every component kind the playground can produce, not three cases. */
	const KINDS = [
		'resistor:R1 "1 kΩ" at (330, 150) #amber [type=thermistor]',
		'capacitor:C1 "100 nF" at (330, 150) #cyan [orientation=down]',
		'source:V1 "V_{cc}" at (330, 150) #blue [type=voltage-dc]',
		'transistor:Q1 "2N3904" at (330, 150) #purple [type=npn]',
		'and:G1 "AND" at (330, 150) #purple',
		'ic:U1 "MCU" at (330, 150) #slate [left=VCC,GND right=TX,RX]',
		'junction:N1 "node" at (330, 150) #cyan',
		'ground:GND "0 V" at (330, 150) #slate [style=earth]',
		'port:P1 "V_{out}" at (330, 150) rgb(255, 128, 0)   // trailing comment'
	];

	test.each(KINDS)('preserves everything but the numbers in %s', (line) => {
		const edit = moveDeclaration(line, 1, { x: 500, y: 260 }, { x: 330, y: 150 });
		expect(edit.kind).toBe('absolute');
		const text = edit.kind === 'absolute' ? edit.text : '';
		/* Everything either side of the coordinate span must be byte-identical. */
		const [beforeOriginal, afterOriginal] = line.split(/at\s*\([^)]*\)/);
		const [beforeEdited, afterEdited] = text.split(/at\s*\([^)]*\)/);
		expect(beforeEdited).toBe(beforeOriginal);
		expect(afterEdited).toBe(afterOriginal);
		expect(text).toContain('at (500, 260)');
	});
});

describe('the edited document still compiles', () => {
	const DOCUMENT = `source:VIN "AC" at (110, 150) #blue [type=voltage-ac]
resistor:R1 "1 kΩ" right-of VIN by 150 #amber
junction:VOUT "V_{out}" right-of R1 by 150 #cyan
capacitor:C1 "100 nF" below VOUT by 110 #cyan [orientation=down]

VIN.positive -> R1.in #blue [line]
R1.out -> VOUT.node #amber [line]
VOUT.node -> C1.in #cyan [ortho]`;

	test('a moved absolute component recompiles where it was dropped', () => {
		const edit = moveDeclaration(DOCUMENT, 1, { x: 150, y: 200 }, { x: 110, y: 150 });
		const document = parseSchematic(edit.kind === 'absolute' ? edit.text : '', fence);
		expect(document.components[0]).toMatchObject({ id: 'VIN', x: 150, y: 200 });
	});

	test('a widened relative gap moves the part by that much', () => {
		const before = compileSchematic(DOCUMENT, fence).placements.find((p) => p.id === 'R1')!;
		const edit = moveDeclaration(
			DOCUMENT,
			2,
			{ x: before.resolved.x + 50, y: before.resolved.y },
			before.resolved
		);
		const after = compileSchematic(
			edit.kind === 'relative' ? edit.text : '',
			fence
		).placements.find((p) => p.id === 'R1')!;
		expect(after.resolved.x).toBe(before.resolved.x + 50);
		expect(after.resolved.y).toBe(before.resolved.y);
	});

	test('and everything downstream of it follows', () => {
		/* The reason to rewrite the relation rather than the coordinates: parts
		   anchored to R1 keep their relationship to it. */
		const before = compileSchematic(DOCUMENT, fence);
		const r1 = before.placements.find((p) => p.id === 'R1')!;
		const vout = before.placements.find((p) => p.id === 'VOUT')!;
		const edit = moveDeclaration(
			DOCUMENT,
			2,
			{ x: r1.resolved.x + 50, y: r1.resolved.y },
			r1.resolved
		);
		const after = compileSchematic(edit.kind === 'relative' ? edit.text : '', fence);
		expect(after.placements.find((p) => p.id === 'VOUT')!.resolved.x).toBe(vout.resolved.x + 50);
	});
});

describe('freezing to absolute', () => {
	const DOCUMENT = `source:VIN "AC" at (110, 150) #blue [type=voltage-ac]
resistor:R1 "1 kΩ" right-of VIN by 150 #amber
capacitor:C1 "100 nF" below R1 by 110 aligned-x with R1 #cyan [orientation=down]

VIN.positive -> R1.in #blue [line]
R1.out -> C1.in #amber [ortho]`;

	test('replaces every relation with the coordinates it resolved to', () => {
		const compilation = compileSchematic(DOCUMENT, fence);
		const frozen = freezeToAbsolute(DOCUMENT, compilation.placements);
		expect(frozen).not.toMatch(/right-of|below|aligned-x/);
		expect(frozen).toContain('#cyan [orientation=down]');
	});

	test('the frozen document compiles to the same placement, byte for byte', () => {
		/* The claim that makes freezing safe: it is a change of notation only. */
		const compilation = compileSchematic(DOCUMENT, { ...fence, mode: 'full' });
		const frozen = freezeToAbsolute(DOCUMENT, compilation.placements);
		expect(compileSchematic(frozen, { ...fence, mode: 'full' }).svg).toBe(compilation.svg);
	});

	test('leaves a document that already used coordinates untouched', () => {
		const absolute = 'port:A "A" at (90, 150) #blue';
		expect(freezeToAbsolute(absolute, [])).toBe(absolute);
	});

	test('skips a placement whose line is missing or already absolute', () => {
		expect(
			freezeToAbsolute('port:A "A" at (90, 150) #blue', [
				{ line: 9, resolved: { x: 1, y: 2 } },
				{ line: 1, resolved: { x: 1, y: 2 } }
			])
		).toBe('port:A "A" at (90, 150) #blue');
	});
});
