<script lang="ts">
	import type { PageData } from './$types';
	import Seo from '$lib/components/Seo.svelte';
	import Astable555Lab from '$lib/simulations/labs/Astable555Lab.svelte';
	import BellStateLab from '$lib/simulations/labs/BellStateLab.svelte';
	import DigitalAdderLab from '$lib/simulations/labs/DigitalAdderLab.svelte';
	import QuantumTeleportationLab from '$lib/simulations/labs/QuantumTeleportationLab.svelte';
	import RcLowPassLab from '$lib/simulations/labs/RcLowPassLab.svelte';

	let { data }: { data: PageData } = $props();
</script>

<Seo
	title={`${data.definition.title} — schemd simulation`}
	description={data.definition.summary}
	canonical={`https://schemd.johnowolabiidogun.dev/simulations/${data.version.id}/${data.definition.id}`}
	type="article"
/>

{#if data.definition.id === 'digital-adder'}
	<DigitalAdderLab {...data} />
{:else if data.definition.id === 'rc-low-pass'}
	<RcLowPassLab {...data} />
{:else if data.definition.id === 'bell-state'}
	<BellStateLab {...data} />
{:else if data.definition.id === '555-astable'}
	<Astable555Lab {...data} />
{:else}
	<QuantumTeleportationLab {...data} />
{/if}
