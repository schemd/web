import { describe, expect, it } from 'vitest';
import {
	isPlaygroundWorkspaceId,
	parsePlaygroundDraft,
	playgroundDraftKey,
	PLAYGROUND_DRAFT_MAX_AGE_MS,
	PLAYGROUND_DRAFT_SESSION_KEY,
	serializePlaygroundDraft
} from './playground-draft';

const NOW = 2_000_000_000_000;
const WORKSPACE = {
	source: 'port:A "A" at (80, 80)',
	width: 760,
	height: 440,
	title: 'Recovered schematic',
	mode: 'full' as const
};

describe('playground draft recovery', () => {
	it('isolates recovery slots by tab workspace and compiler version', () => {
		expect(isPlaygroundWorkspaceId('tab_01234567')).toBe(true);
		expect(isPlaygroundWorkspaceId('../shared')).toBe(false);
		expect(playgroundDraftKey('0.4.0', 'tab_01234567')).toBe(
			'schemd.playground.draft.v2:0.4.0:tab_01234567'
		);
		expect(playgroundDraftKey('0.3.8', 'tab_01234567')).not.toBe(
			playgroundDraftKey('0.4.0', 'tab_01234567')
		);
		expect(playgroundDraftKey('0.4.0', 'tab_76543210')).not.toBe(
			playgroundDraftKey('0.4.0', 'tab_01234567')
		);
		expect(PLAYGROUND_DRAFT_SESSION_KEY).toContain('workspace');
	});

	it('round-trips a complete versioned draft', () => {
		expect(parsePlaygroundDraft(serializePlaygroundDraft(WORKSPACE, NOW), NOW)).toEqual({
			schema: 1,
			savedAt: NOW,
			...WORKSPACE
		});
	});

	it('rejects stale, future, malformed, and obsolete drafts', () => {
		const stale = serializePlaygroundDraft(WORKSPACE, NOW - PLAYGROUND_DRAFT_MAX_AGE_MS - 1);
		expect(parsePlaygroundDraft(stale, NOW)).toBeUndefined();
		expect(
			parsePlaygroundDraft(serializePlaygroundDraft(WORKSPACE, NOW + 60_001), NOW)
		).toBeUndefined();
		expect(parsePlaygroundDraft('{', NOW)).toBeUndefined();
		expect(parsePlaygroundDraft('{"schema":2}', NOW)).toBeUndefined();
	});

	it('rejects invalid dimensions, modes, and oversized storage before recovery', () => {
		const base = JSON.parse(serializePlaygroundDraft(WORKSPACE, NOW)) as Record<string, unknown>;
		expect(parsePlaygroundDraft(JSON.stringify({ ...base, width: 12 }), NOW)).toBeUndefined();
		expect(parsePlaygroundDraft(JSON.stringify({ ...base, mode: 'unsafe' }), NOW)).toBeUndefined();
		expect(parsePlaygroundDraft('x'.repeat(300_000), NOW)).toBeUndefined();
	});
});
