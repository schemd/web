<script lang="ts">
	import type { SimulationMotion } from './simulation-motion.svelte';

	interface Props {
		motion: SimulationMotion;
		label?: string;
	}

	let { motion, label = 'simulation animation' }: Props = $props();
</script>

<div class="motion-control">
	<button
		type="button"
		class="btn"
		aria-pressed={motion.paused}
		aria-label={`${motion.paused ? 'Resume' : 'Pause'} ${label}`}
		onclick={() => motion.toggle()}
	>
		{motion.paused ? 'resume animation' : 'pause animation'}
	</button>
	<p class="visually-hidden" aria-live="polite">{motion.status}</p>
	{#if motion.reducedMotion && motion.paused}
		<p class="motion-note">Paused for your reduced-motion preference. Resume only if desired.</p>
	{/if}
</div>

<style>
	.motion-control {
		display: grid;
		gap: var(--space-1);
	}

	.motion-note {
		margin: 0;
		font-size: var(--text-2xs);
		line-height: 1.4;
		color: var(--ink-mute);
	}

	.btn[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
