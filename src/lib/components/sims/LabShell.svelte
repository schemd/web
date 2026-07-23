<script lang="ts">
	/**
	 * Uniform laboratory workspace grid shared by every standalone simulation.
	 *
	 * Three regions, each fed by a snippet so the physics-owning sim component
	 * stays in control of its own state:
	 *   • Control Console  — bounded, viewport-locked, its own scroll.
	 *   • Test Bed         — the live full-mode compiled schematic; scrolls wide.
	 *   • Instrumentation  — viewport-locked rack (oscilloscope + readouts).
	 *
	 * The base HUD (probe/multimeter) is rendered by the sim itself because it is
	 * `position: fixed`; this shell only lays out the workspace columns.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		/** Left column: dense controls, slider arrays, playback utilities. */
		controls: Snippet;
		/** Center column: the interactive compiled SVG test bed. */
		canvas: Snippet;
		/** Right column: 60 FPS oscilloscope and diagnostic readouts. */
		instruments: Snippet;
	}

	let { controls, canvas, instruments }: Props = $props();
</script>

<div class="lab-shell">
	<section class="region console" aria-label="Control console">
		<p class="region-tag microlabel">control console</p>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard-focusable scroll region) -->
		<div class="region-body" role="region" aria-label="Scrollable control console" tabindex="0">
			{@render controls()}
		</div>
	</section>

	<section class="region testbed" aria-label="Test bed workspace">
		<p class="region-tag microlabel">test bed · mode=full</p>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard-focusable scroll region) -->
		<div class="region-body" role="region" aria-label="Scrollable test bed" tabindex="0">
			{@render canvas()}
		</div>
	</section>

	<section class="region rack" aria-label="Instrumentation rack">
		<p class="region-tag microlabel">instrumentation rack</p>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard-focusable scroll region) -->
		<div
			class="region-body"
			role="region"
			aria-label="Scrollable instrumentation rack"
			tabindex="0"
		>
			{@render instruments()}
		</div>
	</section>
</div>

<style>
	.lab-shell {
		display: grid;
		grid-template-columns: minmax(260px, 320px) minmax(0, 1fr) minmax(300px, 360px);
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
	}

	.region {
		background: var(--bg-panel);
		display: flex;
		flex-direction: column;
		min-inline-size: 0;
	}

	.region-tag {
		padding: var(--space-2) var(--space-3);
		border-block-end: 1px solid var(--line);
		background: var(--bg-raised);
	}

	.region-body {
		padding: var(--space-3);
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}

	.region-body:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	/* Side rails stay locked to the viewport with their own overflow. */
	.console,
	.rack {
		position: sticky;
		inset-block-start: calc(var(--header-h) + var(--space-3));
		align-self: start;
		max-block-size: calc(100vh - var(--header-h) - var(--space-6));

		& .region-body {
			overflow: auto;
			min-block-size: 0;
		}
	}

	.testbed .region-body {
		overflow-x: auto;
	}

	@media (max-width: 1100px) {
		.lab-shell {
			grid-template-columns: 1fr;
		}

		.console,
		.rack {
			position: static;
			max-block-size: none;
		}
	}
</style>
