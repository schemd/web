<script lang="ts">
	import type { Snippet } from 'svelte';

	type Pane = 'navigation' | 'preview';

	let {
		navigation,
		editor,
		preview
	}: {
		navigation: Snippet;
		editor: Snippet;
		preview: Snippet;
	} = $props();

	let shell: HTMLElement;
	let navigationWidth = $state(248);
	let previewWidth = $state(520);
	let navigationOpen = $state(true);
	let previewOpen = $state(true);
	let dragging = $state<Pane | undefined>();

	function beginResize(event: PointerEvent, pane: Pane): void {
		const handle = event.currentTarget;
		if (!(handle instanceof HTMLElement)) return;
		dragging = pane;
		handle.setPointerCapture(event.pointerId);
		document.documentElement.dataset.resizing = 'true';
	}

	function resize(event: PointerEvent): void {
		if (!dragging) return;
		const rect = shell.getBoundingClientRect();
		if (dragging === 'navigation') {
			navigationWidth = Math.max(176, Math.min(420, event.clientX - rect.left));
			shell.style.setProperty('--workspace-nav', `${navigationWidth}px`);
		} else {
			previewWidth = Math.max(300, Math.min(820, rect.right - event.clientX));
			shell.style.setProperty('--workspace-preview', `${previewWidth}px`);
		}
	}

	function endResize(): void {
		dragging = undefined;
		delete document.documentElement.dataset.resizing;
		localStorage.setItem(
			'schemd:panes:v1',
			JSON.stringify({ navigationWidth, previewWidth, navigationOpen, previewOpen })
		);
	}

	function toggle(pane: Pane): void {
		if (pane === 'navigation') navigationOpen = !navigationOpen;
		else previewOpen = !previewOpen;
	}

	$effect(() => {
		const saved = localStorage.getItem('schemd:panes:v1');
		if (!saved) return;
		try {
			const value: unknown = JSON.parse(saved);
			if (typeof value !== 'object' || value === null) return;
			if ('navigationWidth' in value && typeof value.navigationWidth === 'number') {
				navigationWidth = Math.max(176, Math.min(420, value.navigationWidth));
			}
			if ('previewWidth' in value && typeof value.previewWidth === 'number') {
				previewWidth = Math.max(300, Math.min(820, value.previewWidth));
			}
			if ('navigationOpen' in value && typeof value.navigationOpen === 'boolean') {
				navigationOpen = value.navigationOpen;
			}
			if ('previewOpen' in value && typeof value.previewOpen === 'boolean') {
				previewOpen = value.previewOpen;
			}
		} catch {
			// Ignore stale user state.
		}
	});
</script>

<section
	bind:this={shell}
	class="workspace-shell"
	class:nav-collapsed={!navigationOpen}
	class:preview-collapsed={!previewOpen}
	style:--workspace-nav={`${navigationWidth}px`}
	style:--workspace-preview={`${previewWidth}px`}
	aria-label="Schematic workspace"
>
	<aside class="workspace-pane workspace-navigation" aria-label="Workspace navigation">
		{@render navigation()}
	</aside>

	<button
		class="resize-handle resize-navigation"
		type="button"
		aria-label="Resize navigation panel"
		onpointerdown={(event) => beginResize(event, 'navigation')}
		onpointermove={resize}
		onpointerup={endResize}
		onlostpointercapture={endResize}
	></button>

	<div class="workspace-pane workspace-editor">
		{@render editor()}
	</div>

	<button
		class="resize-handle resize-preview"
		type="button"
		aria-label="Resize preview panel"
		onpointerdown={(event) => beginResize(event, 'preview')}
		onpointermove={resize}
		onpointerup={endResize}
		onlostpointercapture={endResize}
	></button>

	<aside class="workspace-pane workspace-preview" aria-label="Compiled output">
		{@render preview()}
	</aside>

	<footer class="workspace-status">
		<div>
			<button type="button" aria-pressed={navigationOpen} onclick={() => toggle('navigation')}>
				{navigationOpen ? 'Hide' : 'Show'} explorer
			</button>
			<button type="button" aria-pressed={previewOpen} onclick={() => toggle('preview')}>
				{previewOpen ? 'Hide' : 'Show'} preview
			</button>
		</div>
		<span>{dragging ? `Resizing ${dragging}` : 'Pointer-capture grid · no layout polling'}</span>
	</footer>
</section>
