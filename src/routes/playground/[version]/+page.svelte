<script lang="ts">
	import type { PageProps } from './$types';
	import Seo from '$lib/components/Seo.svelte';
	import PlaygroundWorkbench from '$lib/components/PlaygroundWorkbench.svelte';

	let { data }: PageProps = $props();
</script>

<Seo
	title={`schemd ${data.version} playground — live SVG compiler`}
	description="Compile schemd source, inspect semantic SVG, map nodes to source, and share compressed workspace state."
	canonical={`https://schemd.johnowolabiidogun.dev/playground/${data.version}`}
/>

<div class="playground-page">
	<h1 class="sr-only">schemd {data.version} playground</h1>
	<div class="route-ribbon">
		<p><span>WORKSPACE</span> / playground / {data.version}</p>
		<small>Server compiler channel · semantic event delegation</small>
	</div>
	<PlaygroundWorkbench
		version={data.version}
		initialSource={data.initialSource}
		initialCode={data.initialCode}
	/>
</div>
