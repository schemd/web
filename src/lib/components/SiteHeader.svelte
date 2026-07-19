<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { emitTone } from '$lib/audio';

	let {
		versions = ['v0.2.1'],
		stableVersion = 'v0.2.1',
		onOpenCommand
	}: {
		versions?: readonly string[];
		stableVersion?: string;
		onOpenCommand: () => void;
	} = $props();

	let audioEnabled = $state(false);
	let mobileOpen = $state(false);

	function versionPath(version: string): string {
		const path = page.url.pathname;
		if (/^\/(?:docs|playground|simulations)\/v[^/]+/u.test(path)) {
			return path.replace(/^\/(docs|playground|simulations)\/v[^/]+/u, `/$1/${version}`);
		}
		return `/docs/${version}/overview`;
	}

	async function selectVersion(event: Event): Promise<void> {
		const select = event.currentTarget;
		if (!(select instanceof HTMLSelectElement)) return;
		await goto(`${versionPath(select.value)}${page.url.search}`);
	}

	function toggleAudio(): void {
		audioEnabled = !audioEnabled;
		localStorage.setItem('schemd:audio', String(audioEnabled));
		window.dispatchEvent(new CustomEvent('schemd:audio-toggle', { detail: audioEnabled }));
		if (audioEnabled) emitTone('success');
	}

	onMount(() => {
		audioEnabled = localStorage.getItem('schemd:audio') === 'true';
	});
</script>

<header class="site-header" data-open={mobileOpen}>
	<a class="brand-lockup" href="/" aria-label="schemd home">
		<img src="/brand/schemd-mark.svg" alt="" width="34" height="34" />
		<span>schemd</span>
		<small>vector compiler</small>
	</a>

	<nav class="primary-nav" aria-label="Primary navigation">
		<a href={`/docs/${stableVersion}/overview`}>Docs</a>
		<a href={`/playground/${stableVersion}`}>Playground</a>
		<a href={`/simulations/${stableVersion}`}>Laboratory</a>
		<a href="/changelog">Changelog</a>
	</nav>

	<div class="header-actions">
		<label class="version-select">
			<span class="sr-only">Documentation version</span>
			<select value={stableVersion} onchange={selectVersion} aria-label="Version">
				{#each versions as version}
					<option value={version}>{version}</option>
				{/each}
			</select>
		</label>
		<button
			class="icon-button"
			type="button"
			aria-pressed={audioEnabled}
			aria-label={audioEnabled ? 'Disable audio feedback' : 'Enable audio feedback'}
			onclick={toggleAudio}
		>
			{audioEnabled ? 'AUDIO·ON' : 'AUDIO·OFF'}
		</button>
		<button class="command-trigger" type="button" onclick={onOpenCommand}>
			<span>Command</span><kbd>⌘ K</kbd>
		</button>
		<button
			class="nav-toggle"
			type="button"
			aria-label="Toggle navigation"
			aria-expanded={mobileOpen}
			onclick={() => (mobileOpen = !mobileOpen)}
		>
			<span></span><span></span>
		</button>
	</div>
</header>
