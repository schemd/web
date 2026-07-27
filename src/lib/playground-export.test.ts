import { describe, expect, test } from 'vitest';
import {
	MAX_RASTER_DIMENSION,
	MAX_RASTER_PIXELS,
	rasterExportScale
} from './playground-export';

describe('playground raster export budget', () => {
	test('keeps ordinary diagrams at 2x and caps worst-case canvases', () => {
		expect(rasterExportScale(760, 440)).toBe(2);
		const worst = rasterExportScale(4_096, 4_096);
		expect(worst).toBe(1);
		expect(4_096 * worst).toBeLessThanOrEqual(MAX_RASTER_DIMENSION);
		expect(4_096 * worst * (4_096 * worst)).toBeLessThanOrEqual(MAX_RASTER_PIXELS);
	});

	test('rejects non-finite and non-positive geometry', () => {
		expect(rasterExportScale(0, 100)).toBe(0);
		expect(rasterExportScale(Number.NaN, 100)).toBe(0);
		expect(rasterExportScale(100, 100, -1)).toBe(0);
	});
});
