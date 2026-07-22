import { describe, expect, test } from 'vitest';
import { scanDocSections } from './markdown';

describe('documentation metadata scan', () => {
	test('extracts navigation without parsing prose or compiling fences', () => {
		const source = `<!-- schemd-doc: id=sample; title=Sample -->
<!-- schemd-section: id=first; title=First pass -->
\`\`\`schemd bounds="64x64" title="deliberately invalid and never compiled"
not valid schemd
\`\`\`
<!-- /schemd-section -->
<!-- schemd-section: id=second; eyebrow=02 -->
Body.
<!-- /schemd-section -->`;

		expect(scanDocSections(source)).toEqual([
			{ id: 'first', title: 'First pass' },
			{ id: 'second', title: 'second' }
		]);
	});
});
