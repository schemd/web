<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();

	/**
	 * The v2 laboratory bench.
	 *
	 * The circuit is the stage, at full width, with its controls on the parts and
	 * its probes clipped to its wires. Instruments sit in a dock beside it, and
	 * utilities (motion, fault injection, presets) in a deck below. Each lab owns
	 * its physics and fills the three snippets.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		tone: 'digital' | 'quantum' | 'analog';
		/** Operating regime in plain words, such as "stopband attenuation". */
		status: string;
		stage: Snippet;
		dock: Snippet;
		deck: Snippet;
		/** One line on how to work the bench. */
		hint?: string;
	}

	let {
		title,
		tone,
		status,
		stage,
		dock,
		deck,
		hint = 'Drag a value tag to change that part. Click a wire to clip a probe on.'
	}: Props = $props();
</script>

<article class="bench" data-tone={tone} data-testid={`${tone}-simulation-workbench`}>
	<div class="bench-grid">
		<section class="stage" aria-label={t('{0}, live circuit', [title])}>
			<header class="stage-bar">
				<span class="microlabel">{t('Live circuit')}</span>
				<span class="state" role="status"><i aria-hidden="true"></i>{t(status)}</span>
			</header>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (on a phone the drawing scrolls sideways, so the keyboard must reach it) -->
			<div
				class="stage-body sheet-grid"
				role="region"
				aria-label={t('{0} drawing', [title])}
				tabindex="0"
			>
				{@render stage()}
			</div>
			<p class="stage-hint">{t(hint)}</p>
		</section>
		<aside class="dock" aria-label={t('{0} instruments', [title])}>
			{@render dock()}
		</aside>
	</div>
	<footer class="deck" aria-label={t('{0} controls', [title])}>
		{@render deck()}
	</footer>
</article>

<style>
	.bench {
		display: grid;
		gap: 1px;
		border: 1px solid var(--line-strong);
		background: var(--line-strong);
	}

	.bench-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1px;
	}

	@media (min-width: 1180px) {
		.bench-grid {
			grid-template-columns: minmax(0, 1fr) 380px;
		}
	}

	.stage {
		display: grid;
		grid-template-rows: auto 1fr auto;
		min-inline-size: 0;
		background: var(--bg-panel);
	}

	.stage-bar {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-block-end: 1px solid var(--line);
	}

	.state {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font: var(--text-sm) / 1.3 var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		color: var(--ink);

		& i {
			inline-size: 7px;
			block-size: 7px;
			border-radius: 50%;
			background: var(--accent);
			box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 20%, transparent);
		}
	}

	.stage-body {
		position: relative;
		min-inline-size: 0;
		overflow-x: auto;
		overscroll-behavior-inline: contain;
		padding: clamp(var(--space-3), 3vw, var(--space-8));
	}

	.stage-hint {
		margin: 0;
		padding: var(--space-2) var(--space-4) var(--space-3);
		font: var(--text-xs) / 1.5 var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		color: var(--ink-mute);
	}

	.dock {
		display: grid;
		align-content: start;
		gap: var(--space-5);
		min-inline-size: 0;
		padding: var(--space-4);
		background: var(--bg-panel);
	}

	.deck {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--space-4) var(--space-6);
		padding: var(--space-4);
		background: var(--bg-panel);
	}

	/* Every drawing fits its stage; on a phone, dense ones keep a legible width
	   and the stage scrolls sideways instead. */
	.bench :global(.sim-stage svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
		max-block-size: 64vh;
	}

	@media (max-width: 760px) {
		.bench :global(.sim-stage svg) {
			min-inline-size: 640px;
			max-block-size: none;
		}
	}

	/* Shared layout for what labs put in the dock and the deck. */
	.bench :global(.bench-block) {
		display: grid;
		gap: var(--space-2);
		min-inline-size: 0;
	}

	.bench :global(.bench-group) {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		min-inline-size: 0;
	}

	.bench :global(.bench-readouts) {
		display: grid;
		gap: var(--space-2);
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}

	.bench :global(.bench-row) {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	/* Current on the wires (see bench/flow.ts). */
	.bench :global(.flow-dots) {
		fill: none;
		stroke: var(--flow-color, var(--live));
		stroke-width: 3.2;
		stroke-linecap: round;
		stroke-dasharray: 0.01 12;
		pointer-events: none;
		animation: bench-flow var(--flow-period, 1s) linear infinite;
		transition: opacity var(--dur-med) var(--ease-precise);
	}

	@keyframes -global-bench-flow {
		to {
			stroke-dashoffset: var(--flow-reach, -12.01);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bench :global(.flow-dots) {
			animation: none;
		}
	}

	.bench :global(.motion-paused .flow-dots) {
		animation-play-state: paused;
	}

	/* The part whose tag is under the pointer or focus. */
	.bench :global([data-node-id].is-tuning) {
		filter: drop-shadow(0 0 6px var(--accent-glow));
	}

	.bench :global(.stage [data-wire-source]) {
		cursor: crosshair;
	}
</style>
