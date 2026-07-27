<script lang="ts">
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import { observeWebVitals, trackPageView } from '$lib/telemetry';

	let stopVitals = (): void => {};
	let nextRouteStartedAt = 0;

	beforeNavigate(() => {
		/* Close the owning route before the next page can contribute layout or
		 * interaction entries to its window. External navigation is finalized
		 * here too; pagehide remains a second idempotent safety net. */
		stopVitals();
		stopVitals = (): void => {};
		nextRouteStartedAt = performance.now();
	});

	afterNavigate((navigation) => {
		if (!navigation.to?.url) return;
		stopVitals();
		trackPageView(navigation.to.url);
		const documentEntry = navigation.type === 'enter';
		stopVitals = observeWebVitals({
			path: navigation.to.url.pathname,
			startTime: documentEntry ? 0 : nextRouteStartedAt || performance.now(),
			includeTtfb: documentEntry
		});
		nextRouteStartedAt = 0;
	});

	onDestroy(() => stopVitals());
</script>
