import { describe, expect, it } from 'vitest';
import {
	decodeWorkspace,
	encodeWorkspace,
	MAX_SOURCE_CHARACTERS,
	type SharedWorkspace
} from './share-state';

const workspace: SharedWorkspace = {
	source: 'port:A "Input" at (80, 100) #blue\nport:B "Output" at (320, 100) #emerald',
	mode: 'full',
	title: 'Shared signal path',
	bounds: '400x200'
};

describe('playground share state', () => {
	it('round-trips the complete workspace through a URL-safe token', async () => {
		const encoded = await encodeWorkspace(workspace);
		expect(encoded.startsWith('z1.')).toBe(true);
		expect(encoded).not.toMatch(/[+/=]/u);
		await expect(decodeWorkspace(encoded)).resolves.toEqual(workspace);
	});

	it('migrates historical fenced query payloads', async () => {
		const legacy = `\`\`\`schemd bounds="440x240" title="Legacy"
${workspace.source}
\`\`\``;
		await expect(decodeWorkspace(legacy)).resolves.toEqual({
			...workspace,
			title: 'Legacy',
			bounds: '440x240'
		});
	});

	it('rejects plain payloads beyond the source budget', async () => {
		await expect(
			decodeWorkspace('x'.repeat(MAX_SOURCE_CHARACTERS + 1_025))
		).resolves.toBeUndefined();
	});
});
