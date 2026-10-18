<script lang="ts">
	/**
	 * Read any part or wire by clicking it.
	 *
	 * The v2 replacement for the floating "arm probe" multimeter: the stage is
	 * always live, and the last thing clicked keeps its reading here, in the
	 * dock, through the lab's own server-authored KaTeX. Labs whose nets carry
	 * waveforms clip scope probes instead (see ProbeLayer); this is for parts
	 * and states that have a value but no trace.
	 */
	import { playTick } from '#lib/audio.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import type { MathReading } from '#lib/simulation-math.ts';
	import LiveMath from '../LiveMath.svelte';

	interface Props {
		host: HTMLElement | undefined;
		/** The lab's reading for a delegated part, port, or wire; undefined if none. */
		read: (element: Element) => MathReading | undefined;
		/** What to click, in the lab's own terms. */
		hint?: string;
	}

	let {
		host,
		read,
		hint = 'Click a part or wire in the drawing to read it here.'
	}: Props = $props();

	let target = $state<Element | undefined>();
	/* Re-read on every render, so the pinned value stays live as the model runs. */
	const reading = $derived(target ? read(target) : undefined);

	$effect(() => {
		const root = host;
		if (!root) return;
		const onClick = (event: MouseEvent) => {
			if (!(event.target instanceof Element)) return;
			const hit = event.target.closest('[data-port-id], [data-wire-source], [data-node-id]');
			if (!hit || !read(hit)) return;
			target = hit;
			if (ui.audio) playTick(740);
		};
		root.addEventListener('click', onClick);
		return () => root.removeEventListener('click', onClick);
	});
</script>

<section class="part-readout" aria-label="Part reading" aria-live="polite">
	<p class="microlabel">Reading</p>
	{#if reading}
		<output class="probe-tip"
			><LiveMath id={reading.id} label={reading.label} values={reading.values} /></output
		>
	{:else}
		<p class="hint">{hint}</p>
	{/if}
</section>

<style>
	.part-readout {
		display: grid;
		gap: var(--space-2);
	}

	output {
		display: block;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-inline-start: 3px solid var(--accent);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}

	.hint {
		margin: 0;
		font: var(--text-xs) / 1.5 var(--font-mono);
		color: var(--ink-mute);
	}
</style>
