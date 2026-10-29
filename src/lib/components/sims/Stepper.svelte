<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();

	/**
	 * Reusable step-by-step playback controller.
	 *
	 * A single `step` index (bindable) drives any staged transformation — Grover
	 * rounds, a ripple-carry pass, a teleportation script. The parent renders the
	 * state for `step`; this bar only owns navigation: Previous, Play/Pause, Next,
	 * Reset, and a segmented progress track. A one-shot timer is re-armed after
	 * each committed step, so stale interval callbacks cannot skip a frame.
	 */
	interface Props {
		/** Current 0-based step (bindable). */
		step?: number;
		/** Total number of steps. */
		count: number;
		/** Optional per-step labels for the progress track and caption. */
		labels?: readonly string[];
		/** Play/pause state (bindable). */
		playing?: boolean;
		/** Auto-advance interval in ms. */
		intervalMs?: number;
		/** Fired after any navigation, with the new step. */
		onchange?: (step: number) => void;
		/** Fired when Reset/Play begins a logically new run from the first stage. */
		onrestart?: () => void;
	}

	let {
		step = $bindable(0),
		count,
		labels = [],
		playing = $bindable(false),
		intervalMs = 1200,
		onchange,
		onrestart
	}: Props = $props();

	const atStart = $derived(step <= 0);
	const atEnd = $derived(step >= count - 1);
	const currentLabel = $derived(labels[step] ?? `Step ${step + 1}`);

	function go(next: number): void {
		if (count <= 0) return;
		const clamped = Math.max(0, Math.min(count - 1, next));
		if (clamped !== step) {
			step = clamped;
			onchange?.(clamped);
		}
	}

	function previous(): void {
		playing = false;
		go(step - 1);
	}

	function next(): void {
		go(step + 1);
	}

	function reset(): void {
		playing = false;
		onrestart?.();
		go(0);
	}

	function toggle(): void {
		if (atEnd) {
			onrestart?.();
			go(0); /* replay from the top */
		}
		playing = !playing;
	}

	/* One pending timeout, one causal transition. Reading `step` before scheduling
	 * intentionally re-arms the timer after the parent commits the frame. */
	$effect(() => {
		if (!playing) return;
		if (step >= count - 1) {
			playing = false;
			return;
		}
		const nextStep = step + 1;
		const timer = setTimeout(() => go(nextStep), Math.max(0, intervalMs));
		return () => clearTimeout(timer);
	});
</script>

<div class="stepper" role="group" aria-label={t('Playback controls')}>
	<div class="transport">
		<button
			type="button"
			class="step-btn"
			onclick={previous}
			disabled={atStart}
			aria-label={t('Previous step')}
			title={t('Previous step')}
		>
			⏮
		</button>
		<button
			type="button"
			class="step-btn play"
			aria-pressed={playing}
			onclick={toggle}
			aria-label={playing ? t('Pause') : t('Play')}
			title={playing ? t('Pause') : t('Play')}
		>
			{playing ? t('⏸') : t('▶')}
		</button>
		<button
			type="button"
			class="step-btn"
			onclick={next}
			data-action="next-step"
			disabled={atEnd}
			aria-label={t('Next step')}
			title={t('Next step')}
		>
			⏭
		</button>
		<button
			type="button"
			class="step-btn"
			onclick={reset}
			disabled={atStart && !playing}
			aria-label={t('Reset to first step')}
			title={t('Reset')}
		>
			⭯
		</button>
	</div>

	<div class="track" role="group" aria-label={t('Choose propagation stage')}>
		{#each { length: count } as d, index (`${index}-${d}`)}
			<button
				type="button"
				class="tick"
				class:done={index < step}
				class:current={index === step}
				onclick={() => {
					playing = false;
					go(index);
				}}
				aria-label={t(labels[index] ?? `Step ${index + 1}`)}
				title={t(labels[index] ?? `Step ${index + 1}`)}
			></button>
		{/each}
	</div>

	<p class="caption">
		<span class="microlabel">{t('Step')} {t(step + 1)} / {t(count)}</span>
		<span class="label">{t(currentLabel)}</span>
	</p>
</div>

<style>
	.stepper {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--line-strong);
		background: var(--bg-inset);
	}

	.transport {
		display: flex;
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
	}

	.step-btn {
		flex: 1;
		padding: 0.45rem 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);
		background: var(--bg-raised);
		transition:
			color var(--dur-fast) var(--ease-precise),
			background-color var(--dur-fast) var(--ease-precise);

		&:hover:not(:disabled) {
			color: var(--ink);
			background: var(--bg-panel);
		}

		&:disabled {
			opacity: 0.35;
			cursor: not-allowed;
		}

		&.play {
			color: var(--bg);
			background: var(--ink);
			flex: 1.4;
		}

		&.play[aria-pressed='true'] {
			color: var(--ink);
			background: var(--bg-raised);
		}
	}

	.track {
		display: flex;
		gap: 1px;
	}

	.tick {
		position: relative;
		flex: 1;
		min-inline-size: 24px;
		block-size: 24px;
		padding: 0;
		background: transparent;

		&::before {
			content: '';
			position: absolute;
			inset: 9px 1px;
			background: var(--line);
			transition: background-color var(--dur-fast) var(--ease-precise);
		}

		&:hover::before {
			background: var(--ink-faint);
		}

		&.done::before {
			background: var(--line-strong);
		}

		&.current::before {
			background: var(--ink);
			box-shadow: 0 0 6px var(--glow);
		}
	}

	.caption {
		margin: 0;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.label {
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
		font-size: var(--text-xs);
		color: var(--ink-mute);
		text-align: end;
	}
</style>
