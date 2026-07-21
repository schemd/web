<script lang="ts">
	/**
	 * Reusable step-by-step playback controller.
	 *
	 * A single `step` index (bindable) drives any staged transformation — Grover
	 * rounds, a ripple-carry pass, a teleportation script. The parent renders the
	 * state for `step`; this bar only owns navigation: Previous, Play/Pause, Next,
	 * Reset, and a segmented progress track. Play auto-advances on an interval and
	 * latches at the final step. Svelte 5 runes throughout; the interval depends
	 * only on `playing`, so stepping never thrashes the timer.
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
	}

	let {
		step = $bindable(0),
		count,
		labels = [],
		playing = $bindable(false),
		intervalMs = 1200,
		onchange
	}: Props = $props();

	const atStart = $derived(step <= 0);
	const atEnd = $derived(step >= count - 1);
	const currentLabel = $derived(labels[step] ?? `Step ${step + 1}`);

	function go(next: number): void {
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
		go(0);
	}

	function toggle(): void {
		if (atEnd) go(0); /* replay from the top */
		playing = !playing;
	}

	/* Auto-advance while playing. The effect tracks only `playing`; the interval
	 * callback reads `step` lazily, so advancing does not re-arm the timer. */
	$effect(() => {
		if (!playing) return;
		const timer = setInterval(() => {
			if (step >= count - 1) playing = false;
			else next();
		}, intervalMs);
		return () => clearInterval(timer);
	});
</script>

<div class="stepper" role="group" aria-label="Playback controls">
	<div class="transport">
		<button
			type="button"
			class="step-btn"
			onclick={previous}
			disabled={atStart}
			aria-label="Previous step"
			title="Previous step"
		>
			⏮
		</button>
		<button
			type="button"
			class="step-btn play"
			aria-pressed={playing}
			onclick={toggle}
			aria-label={playing ? 'Pause' : 'Play'}
			title={playing ? 'Pause' : 'Play'}
		>
			{playing ? '⏸' : '▶'}
		</button>
		<button
			type="button"
			class="step-btn"
			onclick={next}
			disabled={atEnd}
			aria-label="Next step"
			title="Next step"
		>
			⏭
		</button>
		<button
			type="button"
			class="step-btn"
			onclick={reset}
			disabled={atStart && !playing}
			aria-label="Reset to first step"
			title="Reset"
		>
			⭯
		</button>
	</div>

	<div
		class="track"
		role="progressbar"
		aria-valuemin="1"
		aria-valuemax={count}
		aria-valuenow={step + 1}
	>
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
				aria-label={labels[index] ?? `Step ${index + 1}`}
				title={labels[index] ?? `Step ${index + 1}`}
			></button>
		{/each}
	</div>

	<p class="caption">
		<span class="microlabel">step {step + 1} / {count}</span>
		<span class="label">{currentLabel}</span>
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
			color: var(--accent-ink);
			background: var(--accent);
			flex: 1.4;
		}

		&.play[aria-pressed='true'] {
			color: var(--accent);
			background: var(--bg-raised);
		}
	}

	.track {
		display: flex;
		gap: 3px;
	}

	.tick {
		flex: 1;
		block-size: 5px;
		padding: 0;
		background: var(--line);
		transition: background-color var(--dur-fast) var(--ease-precise);

		&:hover {
			background: var(--ink-faint);
		}

		&.done {
			background: color-mix(in srgb, var(--accent) 55%, var(--line));
		}

		&.current {
			background: var(--accent);
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
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--accent-2);
		text-align: end;
	}
</style>
