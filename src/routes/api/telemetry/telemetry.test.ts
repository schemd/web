import { describe, expect, test } from 'vitest';
import { _parseTelemetryBatch } from './+server';

describe('telemetry ingestion', () => {
	test('accepts anonymous bounded product signals', () => {
		const events = _parseTelemetryBatch({
			events: [
				{ v: 1, type: 'page_view', at: 1, path: '/docs/0.3/overview', viewport: 'small' },
				{ v: 1, type: 'web_vital', at: 2, path: '/', name: 'LCP', value: 1234, rating: 'good' },
				{ v: 1, type: 'interaction', at: 3, path: '/playground/0.3.3', name: 'copy_share' }
			]
		});
		expect(events).toHaveLength(3);
	});

	test('rejects identifiers, query strings masquerading as paths, and unknown actions', () => {
		expect(
			_parseTelemetryBatch({
				events: [
					{ v: 1, type: 'interaction', at: 1, path: 'https://tracker.test', name: 'record_source' }
				]
			})
		).toBeUndefined();
		expect(
			_parseTelemetryBatch({
				events: [{ v: 1, type: 'page_view', at: 1, path: '/docs?email=leak', viewport: 'small' }]
			})
		).toBeUndefined();
	});
});
