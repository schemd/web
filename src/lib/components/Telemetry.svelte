<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { observeWebVitals, trackPageView } from '$lib/telemetry';

	afterNavigate((navigation) => {
		if (navigation.to?.url) trackPageView(navigation.to.url);
	});

	onMount(() => observeWebVitals());
</script>
