<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();

	import type { SimulationMotion } from './simulation-motion.svelte';

	interface Props {
		motion: SimulationMotion;
		label?: string;
	}

	let { motion, label = 'simulation animation' }: Props = $props();

	/* The visible words lead the name, so a voice command of what the button
	 * says reaches it: "Resume animation: buck-converter waveform …". */
	const subject = $derived(label.replace(/\s*animation$/i, ''));
</script>

<div class="motion-control">
	<button
		type="button"
		class="btn"
		aria-pressed={motion.paused}
		aria-label={t('{0} animation: {1}', [motion.paused ? 'Resume' : 'Pause', subject])}
		onclick={() => motion.toggle()}
	>
		{motion.paused ? t('resume animation') : t('pause animation')}
	</button>
	<p class="visually-hidden" aria-live="polite">{t(motion.status)}</p>
	{#if motion.reducedMotion && motion.paused}
		<p class="motion-note">
			{t('Paused for your reduced-motion preference. Resume only if desired.')}
		</p>
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
