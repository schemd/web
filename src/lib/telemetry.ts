import { browser, dev } from '$app/environment';

export type VitalName = 'CLS' | 'INP' | 'LCP' | 'TTFB';
export type VitalRating = 'good' | 'needs-improvement' | 'poor';
export type InteractionName =
	'copy_embed' | 'copy_fence' | 'copy_install' | 'copy_share' | 'download_png' | 'download_svg';

interface EventBase {
	readonly v: 1;
	readonly at: number;
}

export interface PageViewEvent extends EventBase {
	readonly type: 'page_view';
	readonly path: string;
	readonly viewport: 'small' | 'medium' | 'large';
}

export interface VitalEvent extends EventBase {
	readonly type: 'web_vital';
	readonly path: string;
	readonly name: VitalName;
	readonly value: number;
	readonly rating: VitalRating;
}

export interface InteractionEvent extends EventBase {
	readonly type: 'interaction';
	readonly path: string;
	readonly name: InteractionName;
}

export type TelemetryEvent = PageViewEvent | VitalEvent | InteractionEvent;

const ENDPOINT = '/api/telemetry';
const MAX_BATCH = 20;
const queue: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function allowed(): boolean {
	if (!browser || dev) return false;
	const privacyNavigator = navigator as Navigator & { globalPrivacyControl?: boolean };
	return privacyNavigator.globalPrivacyControl !== true && navigator.doNotTrack !== '1';
}

function currentPath(): string {
	return location.pathname.slice(0, 256);
}

function enqueue(event: TelemetryEvent): void {
	if (!allowed()) return;
	queue.push(event);
	if (queue.length >= MAX_BATCH) void flushTelemetry();
	else if (!flushTimer) flushTimer = setTimeout(() => void flushTelemetry(), 1_500);
}

/** Flush a bounded, anonymous batch. No cookies, source text, query strings, or identifiers. */
export async function flushTelemetry(): Promise<void> {
	if (flushTimer) clearTimeout(flushTimer);
	flushTimer = undefined;
	if (!allowed() || queue.length === 0) return;
	const events = queue.splice(0, MAX_BATCH);
	const body = JSON.stringify({ events });
	if (document.visibilityState === 'hidden' && navigator.sendBeacon) {
		const accepted = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
		if (accepted) return;
	}
	try {
		await fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body,
			keepalive: true
		});
	} catch {
		/* Telemetry is observability, never a user-facing failure path. */
	}
}

export function trackPageView(url: URL): void {
	if (!allowed()) return;
	const width = innerWidth;
	enqueue({
		v: 1,
		type: 'page_view',
		at: Date.now(),
		path: url.pathname.slice(0, 256),
		viewport: width < 640 ? 'small' : width < 1024 ? 'medium' : 'large'
	});
}

export function trackInteraction(name: InteractionName): void {
	enqueue({ v: 1, type: 'interaction', at: Date.now(), path: currentPath(), name });
}

const THRESHOLDS: Readonly<Record<VitalName, readonly [number, number]>> = {
	CLS: [0.1, 0.25],
	INP: [200, 500],
	LCP: [2_500, 4_000],
	TTFB: [800, 1_800]
};

/** Canonical Web Vitals classification shared with ingestion validation. */
export function vitalRating(name: VitalName, value: number): VitalRating {
	const [good, poor] = THRESHOLDS[name];
	return value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor';
}

function reportVital(name: VitalName, value: number, metricPath: string): void {
	const precision = name === 'CLS' ? 1_000 : 1;
	const rounded = Math.round(value * precision) / precision;
	enqueue({
		v: 1,
		type: 'web_vital',
		at: Date.now(),
		path: metricPath,
		name,
		value: rounded,
		rating: vitalRating(name, rounded)
	});
}

interface LayoutShiftEntry extends PerformanceEntry {
	readonly hadRecentInput: boolean;
	readonly value: number;
}

interface EventTimingEntry extends PerformanceEntry {
	readonly duration: number;
	readonly interactionId?: number;
}

interface VitalObservation {
	/** Route owning this observation window; captured so later navigation cannot steal it. */
	readonly path: string;
	/** `performance.now()` at a soft-navigation boundary, or zero for document entry. */
	readonly startTime?: number;
	/** TTFB belongs only to the document navigation, never a client-side route. */
	readonly includeTtfb?: boolean;
}

interface LayoutShiftValue {
	readonly startTime: number;
	readonly value: number;
}

/**
 * CLS is the largest session window, not the lifetime sum: shifts belong to one
 * window while adjacent entries are <1 s apart and the whole window is <=5 s.
 */
export function _maxClsSessionWindow(entries: readonly LayoutShiftValue[]): number {
	let maximum = 0;
	let windowValue = 0;
	let windowStart = 0;
	let previous = 0;
	for (const entry of entries) {
		if (
			windowValue > 0 &&
			entry.startTime - previous < 1_000 &&
			entry.startTime - windowStart <= 5_000
		) {
			windowValue += entry.value;
		} else {
			windowValue = entry.value;
			windowStart = entry.startTime;
		}
		previous = entry.startTime;
		maximum = Math.max(maximum, windowValue);
	}
	return maximum;
}

/**
 * Approximate the INP p98 selection used by the Web Vitals algorithm from the
 * ten longest unique interactions. The browser exposes the interaction count;
 * every fifty interactions move the selected rank one place down the list.
 */
export function _estimateInp(
	longestDurations: readonly number[],
	interactionCount: number
): number {
	if (longestDurations.length === 0) return 0;
	const descending = [...longestDurations].sort((left, right) => right - left).slice(0, 10);
	const rank = Math.min(descending.length - 1, Math.floor(Math.max(0, interactionCount) / 50));
	return descending[rank] ?? 0;
}

/** Observe one route-bounded window of the field metrics this interface can improve. */
export function observeWebVitals(observation?: VitalObservation): () => void {
	if (!allowed() || typeof PerformanceObserver === 'undefined') return () => {};
	const metricPath = (observation?.path ?? currentPath()).slice(0, 256);
	const startTime = Math.max(0, observation?.startTime ?? 0);
	const observers: PerformanceObserver[] = [];
	const interactions = new Map<number, number>();
	let clsMaximum = 0;
	let clsWindowValue = 0;
	let clsWindowStart = 0;
	let clsPrevious = 0;
	const initialInteractionCount =
		startTime === 0
			? 0
			: ((performance as Performance & { interactionCount?: number }).interactionCount ?? 0);
	let lcp = 0;
	let finalized = false;

	const observe = (type: string, handler: (entries: readonly PerformanceEntry[]) => void): void => {
		try {
			const observer = new PerformanceObserver((list) => handler(list.getEntries()));
			observer.observe({ type, buffered: true });
			observers.push(observer);
		} catch {
			/* Unsupported metric in this engine. */
		}
	};

	const navigation = performance.getEntriesByType('navigation')[0] as
		PerformanceNavigationTiming | undefined;
	if (observation?.includeTtfb && navigation && navigation.responseStart > 0) {
		reportVital('TTFB', navigation.responseStart, metricPath);
	}

	observe('largest-contentful-paint', (entries) => {
		const last = entries.filter((entry) => entry.startTime >= startTime).at(-1);
		if (last) lcp = last.startTime - startTime;
	});
	observe('layout-shift', (entries) => {
		for (const entry of entries as readonly LayoutShiftEntry[]) {
			if (!entry.hadRecentInput && entry.startTime >= startTime) {
				const at = entry.startTime - startTime;
				if (clsWindowValue > 0 && at - clsPrevious < 1_000 && at - clsWindowStart <= 5_000) {
					clsWindowValue += entry.value;
				} else {
					clsWindowValue = entry.value;
					clsWindowStart = at;
				}
				clsPrevious = at;
				clsMaximum = Math.max(clsMaximum, clsWindowValue);
			}
		}
	});
	observe('event', (entries) => {
		for (const entry of entries as readonly EventTimingEntry[]) {
			const id = entry.interactionId ?? 0;
			if (id > 0 && entry.startTime >= startTime) {
				interactions.set(id, Math.max(interactions.get(id) ?? 0, entry.duration));
			}
		}
		if (interactions.size > 10) {
			const longest = [...interactions.entries()]
				.sort((left, right) => right[1] - left[1])
				.slice(0, 10);
			interactions.clear();
			for (const [id, duration] of longest) interactions.set(id, duration);
		}
	});

	const finalize = (): void => {
		if (finalized) return;
		finalized = true;
		if (lcp > 0) reportVital('LCP', lcp, metricPath);
		reportVital('CLS', clsMaximum, metricPath);
		const finalInteractionCount = (performance as Performance & { interactionCount?: number })
			.interactionCount;
		const interactionCount =
			finalInteractionCount === undefined
				? interactions.size
				: Math.max(interactions.size, finalInteractionCount - initialInteractionCount);
		const inp = _estimateInp([...interactions.values()], interactionCount);
		if (inp > 0) reportVital('INP', inp, metricPath);
		void flushTelemetry();
		for (const observer of observers) observer.disconnect();
	};
	const onVisibility = (): void => {
		if (document.visibilityState === 'hidden') finalize();
	};
	document.addEventListener('visibilitychange', onVisibility);
	addEventListener('pagehide', finalize, { once: true });
	return () => {
		document.removeEventListener('visibilitychange', onVisibility);
		removeEventListener('pagehide', finalize);
		finalize();
	};
}
