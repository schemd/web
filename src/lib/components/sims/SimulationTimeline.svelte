<script lang="ts">
	/** Universal, causal playback rail shared by every simulation environment. */
	import { clearPropagationFrame, setPropagationFrame } from '$lib/sim-dom';
	import {
		cumulativeFrame,
		SIMULATION_TIMELINE_EVENT,
		type SimulationStage,
		type SimulationTimelineDetail
	} from '$lib/simulation-timelines';
	import Stepper from './Stepper.svelte';

	interface Props {
		simulationId: string;
		stages: readonly SimulationStage[];
		host?: HTMLElement;
	}

	let { simulationId, stages, host }: Props = $props();
	let step = $state(0);
	let playing = $state(false);
	let delayMs = $state(750);
	let revision = $state(0);
	const labels = $derived(stages.map((item) => item.label));
	const current = $derived(stages[step]);

	function replay(): void {
		if (host) clearPropagationFrame(host);
		step = 0;
		revision += 1;
		playing = true;
	}

	/* Restart after a meaningful lab interaction. Range inputs wait for `change`
	 * so dragging a control does not allocate a train of redundant timers. */
	$effect(() => {
		const root = host;
		if (!root) return;
		const onClick = (event: Event): void => {
			if (!(event.target instanceof Element)) return;
			if (event.target.closest('button, [data-node-id], [data-wire-source]')) replay();
		};
		const onChange = (event: Event): void => {
			if (!(event.target instanceof HTMLInputElement)) return;
			replay();
		};
		root.addEventListener('click', onClick);
		root.addEventListener('change', onChange);
		return () => {
			root.removeEventListener('click', onClick);
			root.removeEventListener('change', onChange);
		};
	});

	/* Paint and announce exactly once per causal frame. The event lets a model
	 * such as Grover or the adder commit numerical state at the same boundary as
	 * the SVG, rather than displaying the answer before the signal arrives. */
	$effect(() => {
		void revision;
		const root = host;
		const frame = cumulativeFrame(stages, step);
		if (!root || !frame) return;
		const detail: SimulationTimelineDetail = { simulationId, step, delayMs };
		window.dispatchEvent(new CustomEvent(SIMULATION_TIMELINE_EVENT, { detail }));
		let cancelled = false;
		/* Let the simulation commit its electrical classes first; high-only inputs
		 * are then filtered against the resulting logic state without a reflow. */
		queueMicrotask(() => {
			if (!cancelled && root.isConnected) setPropagationFrame(root, frame);
		});
		return () => {
			cancelled = true;
			if (!root.isConnected) clearPropagationFrame(root);
		};
	});
</script>

{#if stages.length > 0}
	<section class="timeline panel" aria-label="Signal propagation timeline">
		<div class="timeline-copy">
			<div class="timeline-heading">
				<span class="microlabel">causal signal trace</span>
				<span class="status" class:running={playing}>
					{playing ? 'propagating' : step === stages.length - 1 ? 'settled' : 'paused'}
				</span>
			</div>
			<p class="explanation" aria-live="polite">
				<strong>{current?.label}</strong>
				{current?.explanation}
			</p>
			<label class="delay-control">
				<span class="microlabel">stage delay = {(delayMs / 1000).toFixed(2)} s</span>
				<input
					type="range"
					min="250"
					max="2500"
					step="250"
					bind:value={delayMs}
					aria-label="Propagation stage delay"
				/>
			</label>
		</div>
		<Stepper bind:step bind:playing count={stages.length} {labels} intervalMs={delayMs} />
	</section>
{/if}

<style>
	.timeline {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
	}

	.timeline-copy {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-4);
		background: var(--bg-panel);
	}

	.timeline-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.status {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink-faint);

		&.running {
			color: var(--accent);
		}
	}

	.explanation {
		margin: 0;
		display: grid;
		gap: var(--space-1);
		font-size: var(--text-sm);
		line-height: 1.6;
		color: var(--ink-mute);

		& strong {
			color: var(--ink);
			font-weight: 620;
		}
	}

	.delay-control {
		display: grid;
		grid-template-columns: max-content minmax(120px, 1fr);
		align-items: center;
		gap: var(--space-3);
	}

	.timeline :global(.stepper) {
		block-size: 100%;
		border: 0;
	}

	/* The teaching overlay is deliberately independent of electrical state. */
	:global(.simulation-host.is-teaching [data-node-id]),
	:global(.simulation-host.is-teaching [data-wire-source]) {
		opacity: 0.2;
		transition:
			opacity 180ms var(--ease-precise),
			filter 180ms var(--ease-precise);
	}

	:global(.simulation-host.is-teaching [data-node-id].is-propagating),
	:global(.simulation-host.is-teaching [data-wire-source].is-propagating) {
		opacity: 1;
		filter: drop-shadow(0 0 5px var(--glow));
	}

	@media (max-width: 900px) {
		.timeline {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 520px) {
		.timeline-copy {
			padding: var(--space-3);
		}

		.delay-control {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.simulation-host.is-teaching [data-node-id]),
		:global(.simulation-host.is-teaching [data-wire-source]) {
			transition: none;
		}
	}
</style>
