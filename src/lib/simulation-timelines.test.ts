import { describe, expect, it } from 'vitest';
import {
	cumulativeFrame,
	SIMULATION_TIMELINES,
	timelineFor,
	travellingFrame
} from './simulation-timelines';

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

	it('replays the two-round Grover optimum and one explicit over-rotation before measurement', () => {
		const labels = timelineFor('grover').map((frame) => frame.label);
		expect(labels).toEqual([
			'Uniform superposition',
			'Round 1 · oracle',
			'Round 1 · mean',
			'Round 1 · inversion',
			'Round 2 · oracle',
			'Round 2 · mean',
			'Round 2 · inversion',
			'Round 3 · oracle',
			'Round 3 · mean',
			'Round 3 · over-rotation',
			'Measurement'
		]);
	});

	it('prepares LFSR feedback before one atomic register edge', () => {
		expect(timelineFor('lfsr').map((frame) => frame.label)).toEqual([
			'Form the feedback bit',
			'Clock the register',
			'Commit all four stages',
			'Emit the sequence bit'
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

	describe('travelling front', () => {
		it('opens with a front and no trail behind it', () => {
			const frame = travellingFrame(timelineFor('grover'), 0);
			expect(frame?.settledNodes).toBeUndefined();
			expect(frame?.settledWires).toBeUndefined();
		});

		it('carries only the current stage in the active tier', () => {
			const stages = timelineFor('grover');
			const frame = travellingFrame(stages, 2);
			expect(frame?.nodes).toEqual(stages[2]!.nodes);
			expect(frame?.wires).toEqual(stages[2]!.wires);
		});

		it('trails every earlier stage, and only earlier stages', () => {
			const stages = timelineFor('grover');
			const frame = travellingFrame(stages, 2);
			const earlier = cumulativeFrame(stages, 1);
			expect(frame?.settledNodes).toEqual(earlier!.nodes);
			/* The stage after the front must not have been reached yet. */
			for (const id of stages[3]?.nodes ?? []) {
				if (!earlier!.nodes.includes(id)) expect(frame?.settledNodes).not.toContain(id);
			}
		});

		/*
		 * The regression this whole change exists for: painted as one cumulative
		 * tier, the final step lit every element the run ever touched, which is
		 * indistinguishable from no animation. The last front must stay a front.
		 *
		 * Across nodes *and* wires, because a stage may advance on either —
		 * `statechart` ends on a transition, lighting no node its earlier stages
		 * had not already reached. Asserting over nodes alone called that a
		 * failure when it is simply what that lab's last step is.
		 */
		it.each(ENVIRONMENT_IDS)('%s ends on a front, not on a fully lit drawing', (id) => {
			const stages = timelineFor(id);
			const last = travellingFrame(stages, stages.length - 1);
			const settledNodes = new Set(last?.settledNodes ?? []);
			const settledWires = new Set(last?.settledWires ?? []);
			const arriving =
				(last?.nodes ?? []).filter((node) => !settledNodes.has(node)).length +
				(last?.wires ?? []).filter((wire) => !settledWires.has(wire)).length;
			expect(arriving).toBeGreaterThan(0);
		});

		it('has no stage for a step past the end', () => {
			expect(travellingFrame(timelineFor('rc'), 99)).toBeUndefined();
		});
	});
});
