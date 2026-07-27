import { describe, expect, test } from 'vitest';
import { _parseTelemetryBatch } from './+server';

describe('telemetry ingestion', () => {
	test('accepts anonymous bounded product signals', () => {
		const now = 10_000;
		const events = _parseTelemetryBatch(
			{
				events: [
					{ v: 1, type: 'page_view', at: now - 3, path: '/docs/0.3/overview', viewport: 'small' },
					{
						v: 1,
						type: 'web_vital',
						at: now - 2,
						path: '/',
						name: 'LCP',
						value: 1234,
						rating: 'good'
					},
					{
						v: 1,
						type: 'interaction',
						at: now - 1,
						path: '/playground/0.3.3',
						name: 'copy_share'
					}
				]
			},
			now
		);
		expect(events).toHaveLength(3);
	});

	test('rejects identifiers, query strings masquerading as paths, and unknown actions', () => {
		expect(
			_parseTelemetryBatch(
				{
					events: [
						{
							v: 1,
							type: 'interaction',
							at: 1,
							path: 'https://tracker.test',
							name: 'record_source'
						}
					]
				},
				1
			)
		).toBeUndefined();
		expect(
			_parseTelemetryBatch(
				{
					events: [{ v: 1, type: 'page_view', at: 1, path: '/docs?email=leak', viewport: 'small' }]
				},
				1
			)
		).toBeUndefined();
	});

	test('rejects stale clocks and client-supplied vital ratings that contradict the value', () => {
		const now = 2 * 24 * 60 * 60 * 1_000;
		expect(
			_parseTelemetryBatch(
				{
					events: [{ v: 1, type: 'page_view', at: 1, path: '/', viewport: 'small' }]
				},
				now
			)
		).toBeUndefined();
		expect(
			_parseTelemetryBatch(
				{
					events: [
						{
							v: 1,
							type: 'web_vital',
							at: now,
							path: '/',
							name: 'LCP',
							value: 5_000,
							rating: 'good'
						}
					]
				},
				now
			)
		).toBeUndefined();
	});
});
