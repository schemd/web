import { describe, expect, it } from 'vitest';
import { curriculumMap } from './curriculum-map';
import { listSimulationEnvironments } from './simulations';

describe('curriculum map', () => {
	const environments = listSimulationEnvironments();
	const map = curriculumMap(environments);

	it('draws every laboratory as a part, numbered by its lab index', () => {
		expect(map).not.toBeNull();
		for (const environment of environments) {
			const node = map!.nodes[environment.id];
			expect(node).toBe(`L${environment.index}`);
			expect(map!.svg).toContain(`data-node-id="${node}"`);
		}
	});

	it('groups each lab under the root of its prerequisite track', () => {
		for (const environment of environments) {
			const root = map!.tracks[environment.id]!;
			const rootLab = environments.find((candidate) => candidate.id === root)!;
			expect(rootLab.curriculum.prerequisites).toEqual([]);
			/* Walk the first-prerequisite chain: it must end at this track's root. */
			let walker = environment;
			while (walker.curriculum.prerequisites.length) {
				walker = environments.find(
					(candidate) => candidate.id === walker.curriculum.prerequisites[0]
				)!;
			}
			expect(walker.id).toBe(root);
		}
	});

	it('leaves no part focusable, because the drawing is hidden behind real links', () => {
		expect(map!.svg).not.toContain('tabindex="0"');
		expect(map!.svg).not.toContain('role="button"');
	});

	it('draws a lab two steps from its root as a branch of its own prerequisite', () => {
		expect(map!.svg).toContain(`data-node-id="${map!.nodes.uart}"`);
		expect(map!.tracks.uart).toBe('adder');
		expect(map!.tracks.grover).toBe('bell');
		expect(map!.tracks.sigmadelta).toBe('rc');
	});

	it('compiles once per process', () => {
		expect(curriculumMap(environments)).toBe(map);
	});
});
