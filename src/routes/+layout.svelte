<script lang="ts">
	import '../app.css';
	import type { LayoutProps } from './$types';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import CommandPalette, { type CommandItem } from '$lib/components/CommandPalette.svelte';

	let { children, data }: LayoutProps = $props();
	let commandOpen = $state(false);

	const commandItems = $derived<readonly CommandItem[]>([
		{
			title: 'Documentation overview',
			detail: 'Grammar, components, output contracts',
			href: `/docs/${data.platform.currentVersion}/overview`,
			group: 'DOCS'
		},
		{
			title: 'Open playground',
			detail: 'Compile a source buffer with semantic hooks',
			href: `/playground/${data.platform.currentVersion}`,
			group: 'WORKSPACE'
		},
		{
			title: '8-bit digital adder',
			detail: 'Toggle input bits and inspect the carry network',
			href: `/simulations/${data.platform.currentVersion}/digital-adder`,
			group: 'LAB'
		},
		{
			title: 'RC low-pass filter',
			detail: 'Sweep physical parameters across five decades',
			href: `/simulations/${data.platform.currentVersion}/rc-low-pass`,
			group: 'LAB'
		},
		{
			title: 'Bell-state visualizer',
			detail: 'Inspect correlation and probability amplitudes',
			href: `/simulations/${data.platform.currentVersion}/bell-state`,
			group: 'LAB'
		},
		{
			title: '555 astable timer',
			detail: 'Observe capacitor and output timing loops',
			href: `/simulations/${data.platform.currentVersion}/555-astable`,
			group: 'LAB'
		},
		{
			title: 'Quantum teleportation',
			detail: 'Step through a three-qubit protocol',
			href: `/simulations/${data.platform.currentVersion}/quantum-teleportation`,
			group: 'LAB'
		},
		{
			title: 'Release timeline',
			detail: 'Registry metadata and compiler metrics',
			href: '/changelog',
			group: 'PLATFORM'
		}
	]);

	function globalKeydown(event: KeyboardEvent): void {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			commandOpen = !commandOpen;
		}
	}
</script>

<svelte:window onkeydown={globalKeydown} />

<a class="skip-link" href="#main-content">Skip to content</a>
<SiteHeader
	versions={data.versions.map((release) => release.version)}
	stableVersion={data.platform.currentVersion}
	onOpenCommand={() => (commandOpen = true)}
/>
<main id="main-content">
	{@render children()}
</main>
<footer class="site-footer">
	<div>
		<img src="/brand/schemd-mark.svg" alt="" width="28" height="28" />
		<p><strong>schemd</strong><span>Deterministic engineering vectors for the web.</span></p>
	</div>
	<nav aria-label="Footer">
		<a href={`/docs/${data.platform.currentVersion}/overview`}>Documentation</a>
		<a href={`/playground/${data.platform.currentVersion}`}>Playground</a>
		<a href="https://github.com/schemd/core" rel="external">Source</a>
	</nav>
	<small>SSR first · zero runtime dependencies · Node ≥24</small>
</footer>
<CommandPalette bind:open={commandOpen} items={commandItems} />
