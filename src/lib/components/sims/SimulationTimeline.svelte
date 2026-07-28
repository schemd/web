<script lang="ts">
	/** Universal, causal playback rail shared by every simulation environment. */
	import { untrack } from 'svelte';
	import { clearPropagationFrame, setPropagationFrame } from '$lib/sim-dom';
	import { cumulativeFrame, type RenderedSimulationStage } from '$lib/simulation-timelines';
	import type { SimulationTimelineModel } from './simulation-timeline.svelte';
	import Stepper from './Stepper.svelte';
	import LiveMath from './LiveMath.svelte';

	interface Props {
		simulationId: string;
		stages: readonly RenderedSimulationStage[];
		host?: HTMLElement;
		model: SimulationTimelineModel;
	}

	let { simulationId, stages, host, model }: Props = $props();
	let delayMs = $state(750);
	const labels = $derived(stages.map((item) => item.label));
	const current = $derived(stages[model.step]);

	function replay(): void {
		if (host) clearPropagationFrame(host);
		model.restart(true);
	}

	$effect(() => {
		model.count = stages.length;
	});

	/* Route navigation can reuse this component; a different lab is a new run. */
	$effect(() => {
		void simulationId;
		untrack(() => model.restart());
	});

	/*
	 * Restart only for declared model inputs.
	 *
	 * Treating every button as a circuit mutation made Pause, Reset, probe tools,
	 * and internal transport buttons secretly start a new causal run. Native value
	 * controls and compiler-emitted interactive input nodes are model inputs;
	 * custom buttons opt in with `data-timeline-input`.
	 */
	$effect(() => {
		const root = host;
		if (!root) return;
		const onClick = (event: Event): void => {
			if (!(event.target instanceof Element)) return;
			if (
				event.target.closest('[data-timeline-input], .sim-stage [data-node-id] [role="button"]')
			) {
				replay();
			}
		};
		const onChange = (event: Event): void => {
			if (!(event.target instanceof HTMLInputElement)) return;
			if (event.target.closest('.motion-control, .delay-control')) return;
			replay();
		};
		root.addEventListener('click', onClick);
		root.addEventListener('change', onChange);
		return () => {
			root.removeEventListener('click', onClick);
			root.removeEventListener('change', onChange);
		};
	});

	/* Paint exactly once per causal frame. Numerical models consume this same
	 * context state, so they cannot display an answer before the SVG arrives. */
	$effect(() => {
		void model.runId;
		const root = host;
		const frame = cumulativeFrame(stages, model.step);
		if (!root || !frame) return;
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
	<section class="timeline plate" aria-label="Signal propagation timeline">
		<div class="timeline-copy">
			<div class="timeline-heading">
				<span class="microlabel">causal signal trace</span>
				<span class="status" class:running={model.playing}>
					{model.playing ? 'propagating' : model.step === stages.length - 1 ? 'settled' : 'paused'}
				</span>
			</div>
			<p class="explanation" aria-live="polite">
				<strong>{@html current?.labelHtml}</strong>
				<span>{@html current?.explanationHtml}</span>
			</p>
			<label class="delay-control">
				<span class="microlabel"
					><LiveMath
						id="timeline.delay"
						label={`stage delay ${(delayMs / 1000).toFixed(2)} seconds`}
						values={{ value: (delayMs / 1000).toFixed(2) }}
					/></span
				>
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
		<Stepper
			bind:step={model.step}
			bind:playing={model.playing}
			count={stages.length}
			{labels}
			intervalMs={delayMs}
			onrestart={() => (model.runId += 1)}
		/>
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
