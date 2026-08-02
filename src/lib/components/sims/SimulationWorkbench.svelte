<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		eyebrow: string;
		title: string;
		status: string;
		tone: 'digital' | 'quantum' | 'analog';
		canvas: Snippet;
		controls: Snippet;
		readouts: Snippet;
	}

	let { eyebrow, title, status, tone, canvas, controls, readouts }: Props = $props();
</script>

<article class="workbench" data-tone={tone} data-testid={`${tone}-simulation-workbench`}>
	<header class="workbench-bar">
		<div class="identity">
			<span class="aperture" aria-hidden="true"><i></i><i></i><i></i></span>
			<span class="eyebrow">{eyebrow}</span>
			<strong>{title}</strong>
		</div>
		<div class="runtime">
			<span class="pulse" aria-hidden="true"></span>
			<span>{status}</span>
			<code>mode=full</code>
		</div>
	</header>

	<section class="canvas-well" aria-label={`${title} live compiler canvas`}>
		<div class="axis axis-x" aria-hidden="true"></div>
		<div class="axis axis-y" aria-hidden="true"></div>
		{@render canvas()}
	</section>

	<footer class="control-deck">
		<section class="deck-section controls" aria-label={`${title} controls`}>
			<p class="deck-label">control surface</p>
			{@render controls()}
		</section>
		<section class="deck-section telemetry" aria-label={`${title} telemetry`}>
			<p class="deck-label">live telemetry</p>
			{@render readouts()}
		</section>
	</footer>
</article>

<style>
	.workbench {
		--sim-accent: var(--accent);
		--sim-glow: var(--glow);
		position: relative;
		isolation: isolate;
		border: 1px solid color-mix(in srgb, var(--sim-accent) 28%, var(--line));
		border-radius: 14px;
		overflow: hidden;
		background: var(--bg-inset);
		box-shadow:
			0 28px 80px -54px var(--sim-glow),
			inset 0 1px 0 color-mix(in srgb, var(--ink) 9%, transparent);
	}

	.workbench[data-tone='digital'] {
		--sim-accent: #62f6cf;
		--sim-glow: rgb(98 246 207 / 0.42);
	}

	.workbench[data-tone='quantum'] {
		--sim-accent: #a997ff;
		--sim-glow: rgb(169 151 255 / 0.42);
	}

	.workbench[data-tone='analog'] {
		--sim-accent: #61d4ff;
		--sim-glow: rgb(97 212 255 / 0.42);
	}

	.workbench-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-block-size: 52px;
		padding: var(--space-3) var(--space-4);
		border-block-end: 1px solid var(--line);
		background:
			linear-gradient(
				90deg,
				color-mix(in srgb, var(--sim-accent) 8%, transparent),
				transparent 36%
			),
			var(--bg-raised);
	}

	.identity,
	.runtime,
	.aperture {
		display: flex;
		align-items: center;
	}

	.identity {
		gap: var(--space-3);
		min-inline-size: 0;
	}

	.identity strong {
		font-size: var(--text-sm);
		font-weight: 620;
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.eyebrow,
	.runtime,
	.deck-label {
		font-family: var(--font-mono);
		font-size: 0.625rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.eyebrow {
		padding-inline-end: var(--space-3);
		border-inline-end: 1px solid var(--line-strong);
		color: var(--sim-accent);
	}

	.aperture {
		gap: 4px;
	}

	.aperture i {
		inline-size: 5px;
		block-size: 5px;
		border-radius: 50%;
		background: var(--line-strong);
	}

	.aperture i:first-child {
		background: var(--sim-accent);
		box-shadow: 0 0 10px var(--sim-glow);
	}

	.runtime {
		gap: var(--space-2);
		white-space: nowrap;
	}

	.runtime code {
		margin-inline-start: var(--space-2);
		padding: 0.2rem 0.45rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		color: var(--ink-mute);
		background: var(--bg-inset);
		font-size: inherit;
	}

	.pulse {
		inline-size: 6px;
		block-size: 6px;
		border-radius: 50%;
		background: var(--sim-accent);
		box-shadow: 0 0 12px var(--sim-accent);
		animation: breathe 1.8s ease-in-out infinite;
	}

	.canvas-well {
		position: relative;
		min-block-size: 360px;
		overflow: auto;
		background:
			linear-gradient(color-mix(in srgb, var(--sim-accent) 4%, transparent) 1px, transparent 1px),
			linear-gradient(
				90deg,
				color-mix(in srgb, var(--sim-accent) 4%, transparent) 1px,
				transparent 1px
			),
			radial-gradient(
				circle at 50% 22%,
				color-mix(in srgb, var(--sim-accent) 8%, transparent),
				transparent 48%
			),
			#080b0e;
		background-size:
			28px 28px,
			28px 28px,
			auto,
			auto;
	}

	.workbench[data-tone='digital'] .canvas-well {
		max-block-size: min(720px, 78vh);
	}

	.axis {
		position: absolute;
		z-index: 2;
		pointer-events: none;
		background: color-mix(in srgb, var(--sim-accent) 48%, transparent);
		opacity: 0.38;
	}

	.axis-x {
		inset: 18px 20px auto;
		block-size: 1px;
		background: repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 12px);
		color: var(--sim-accent);
	}

	.axis-y {
		inset: 20px auto 18px 18px;
		inline-size: 1px;
		background: repeating-linear-gradient(currentColor 0 1px, transparent 1px 12px);
		color: var(--sim-accent);
	}

	.control-deck {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
		border-block-start: 1px solid var(--line);
		background: var(--bg-panel);
	}

	.deck-section {
		min-inline-size: 0;
		padding: var(--space-4);
	}

	.deck-section + .deck-section {
		border-inline-start: 1px solid var(--line);
	}

	.deck-label {
		margin: 0 0 var(--space-3);
	}

	@keyframes breathe {
		50% {
			opacity: 0.45;
			box-shadow: 0 0 4px var(--sim-accent);
		}
	}

	@media (max-width: 820px) {
		.workbench-bar,
		.control-deck {
			grid-template-columns: 1fr;
		}

		.workbench-bar {
			display: grid;
		}

		.runtime {
			justify-content: flex-start;
		}

		.control-deck {
			display: grid;
		}

		.deck-section + .deck-section {
			border-inline-start: 0;
			border-block-start: 1px solid var(--line);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
		}
	}
</style>
