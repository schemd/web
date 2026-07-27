export const MAX_RASTER_DIMENSION = 4_096;
export const MAX_RASTER_PIXELS = 16 * 1024 * 1024;

/** Highest safe export scale within both canvas dimension and pixel budgets. */
export function rasterExportScale(width: number, height: number, preferred = 2): number {
	if (
		!Number.isFinite(width) ||
		!Number.isFinite(height) ||
		!Number.isFinite(preferred) ||
		width <= 0 ||
		height <= 0 ||
		preferred <= 0
	) {
		return 0;
	}
	return Math.min(
		preferred,
		MAX_RASTER_DIMENSION / width,
		MAX_RASTER_DIMENSION / height,
		Math.sqrt(MAX_RASTER_PIXELS / (width * height))
	);
}
