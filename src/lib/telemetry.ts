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

function path(): string {
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
	enqueue({ v: 1, type: 'interaction', at: Date.now(), path: path(), name });
}

const THRESHOLDS: Readonly<Record<VitalName, readonly [number, number]>> = {
	CLS: [0.1, 0.25],
	INP: [200, 500],
	LCP: [2_500, 4_000],
	TTFB: [800, 1_800]
};

function rating(name: VitalName, value: number): VitalRating {
	const [good, poor] = THRESHOLDS[name];
	return value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor';
}

function reportVital(name: VitalName, value: number): void {
	const precision = name === 'CLS' ? 1_000 : 1;
	const rounded = Math.round(value * precision) / precision;
	enqueue({
		v: 1,
		type: 'web_vital',
		at: Date.now(),
		path: path(),
		name,
		value: rounded,
		rating: rating(name, rounded)
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

/** Observe the four field metrics this interface can improve without a dependency. */
export function observeWebVitals(): () => void {
	if (!allowed() || typeof PerformanceObserver === 'undefined') return () => {};
	const observers: PerformanceObserver[] = [];
	let cls = 0;
	let inp = 0;
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
	if (navigation && navigation.responseStart > 0) reportVital('TTFB', navigation.responseStart);

	observe('largest-contentful-paint', (entries) => {
		const last = entries.at(-1);
		if (last) lcp = last.startTime;
	});
	observe('layout-shift', (entries) => {
		for (const entry of entries as readonly LayoutShiftEntry[]) {
			if (!entry.hadRecentInput) cls += entry.value;
		}
	});
	observe('event', (entries) => {
		for (const entry of entries as readonly EventTimingEntry[]) {
			if ((entry.interactionId ?? 0) > 0) inp = Math.max(inp, entry.duration);
		}
	});

	const finalize = (): void => {
		if (finalized) return;
		finalized = true;
		if (lcp > 0) reportVital('LCP', lcp);
		reportVital('CLS', cls);
		if (inp > 0) reportVital('INP', inp);
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
		for (const observer of observers) observer.disconnect();
	};
}
