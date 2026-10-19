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
			if (environment.curriculum.prerequisites.length) {
				expect(environment.curriculum.prerequisites[0]).toBe(root);
			}
		}
	});

	it('leaves no part focusable, because the drawing is hidden behind real links', () => {
		expect(map!.svg).not.toContain('tabindex="0"');
		expect(map!.svg).not.toContain('role="button"');
	});

	it('compiles once per process', () => {
		expect(curriculumMap(environments)).toBe(map);
	});
});
