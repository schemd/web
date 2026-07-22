import { describe, expect, it } from 'vitest';
import { cumulativeFrame, SIMULATION_TIMELINES, timelineFor } from './simulation-timelines';

const ENVIRONMENT_IDS = [
	'adder',
	'rc',
	'bell',
	'timer',
	'teleport',
	'buck',
	'chua',
	'pll',
	'statechart',
	'qec',
	'wien',
	'lfsr',
	'grover'
] as const;

describe('simulation teaching timelines', () => {
	it('covers every registered simulation exactly once', () => {
		expect(Object.keys(SIMULATION_TIMELINES).sort()).toEqual([...ENVIRONMENT_IDS].sort());
	});

	it.each(ENVIRONMENT_IDS)('%s has a complete causal route', (id) => {
		const timeline = timelineFor(id);
		expect(timeline.length).toBeGreaterThanOrEqual(4);
		expect(new Set(timeline.map((frame) => frame.label)).size).toBe(timeline.length);
		for (const frame of timeline) {
			expect(frame.label.trim().length).toBeGreaterThan(0);
			expect(frame.explanation.trim().length).toBeGreaterThan(20);
			expect(
				frame.nodes.length +
					frame.wires.length +
					(frame.highNodes?.length ?? 0) +
					(frame.highWires?.length ?? 0)
			).toBeGreaterThan(0);
		}
	});

	it('models every ripple-carry cell before committing the final output', () => {
		const timeline = timelineFor('adder');
		expect(timeline).toHaveLength(10);
		for (let bit = 0; bit < 8; bit += 1) {
			expect(timeline[bit + 1]?.nodes).toContain(`O1_${bit}`);
			expect(timeline[bit + 1]?.nodes).toContain(`S${bit}`);
		}
		expect(timeline.at(-1)?.nodes).toContain('COUT');
	});

	it('replays both Grover rounds before measurement', () => {
		const labels = timelineFor('grover').map((frame) => frame.label);
		expect(labels).toEqual([
			'Uniform superposition',
			'Round 1 · oracle',
			'Round 1 · mean',
			'Round 1 · inversion',
			'Round 2 · oracle',
			'Round 2 · mean',
			'Round 2 · inversion',
			'Measurement'
		]);
	});

	it('latches every causal stage and rewinds deterministically', () => {
		const stages = timelineFor('grover');
		const oracle = cumulativeFrame(stages, 1);
		const settled = cumulativeFrame(stages, stages.length - 1);
		expect(oracle?.nodes).toEqual(expect.arrayContaining(['H0', 'ORACLE']));
		expect(oracle?.nodes).not.toContain('M0');
		expect(settled?.nodes).toEqual(expect.arrayContaining(['H0', 'ORACLE', 'DIFF', 'M0']));
		expect(settled).toBeDefined();
		expect(new Set(settled!.wires).size).toBe(settled!.wires.length);
	});

	it('keeps digital inputs in the high-only occupancy channel', () => {
		const adderInput = cumulativeFrame(timelineFor('adder'), 0);
		expect(adderInput?.nodes).not.toContain('A0');
		expect(adderInput?.highNodes).toEqual(expect.arrayContaining(['A0', 'B7', 'CIN']));
		expect(adderInput?.highWires).toContain('A0.out');
	});

	it('returns no fabricated route for an unknown simulation', () => {
		expect(timelineFor('missing')).toEqual([]);
	});
});
