<script lang="ts">
	/**
	 * The manifest interpreter — one component that runs any declarative lab.
	 *
	 * Everything a bespoke sim used to repeat lives here exactly once: the
	 * timeline wiring, the paint effect, the fault switches, the instrument
	 * rack, and the scope buffer. A manifest supplies the drawing, the control
	 * set, the signal-to-node bindings, and the model *name*; this component
	 * supplies the machinery. Nothing here evaluates anything a manifest says —
	 * the model comes from a code-owned registry and the formula is rendered.
	 */
	import { setNetLevel, setNodeActive, setNodeDegraded, setWiresFrom } from '$lib/sim-dom';
	import { expandBindings, type LabManifest, fillIndex } from '$lib/lab-manifest';
	import { resolveLabModel } from '$lib/lab-models';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import LabShell from './LabShell.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import Oscilloscope from './Oscilloscope.svelte';

	interface Props {
		manifest: LabManifest;
		/** The manifest's `source`, compiled server-side in `full` mode. */
		svg: string;
	}

	let { manifest, svg }: Props = $props();

	const timeline = useSimulationTimelineModel();
	let host = $state<HTMLElement | undefined>();

	/* Controls and faults are plain records keyed by the manifest's own keys, so
	   adding a control is a manifest edit rather than a component edit. */
	let inputs = $state<Record<string, number>>(initialInputs());
	let faults = $state<Record<string, boolean>>(initialFaults());
	let scope = $state<number[]>(Array.from({ length: 96 }, () => 0.15));
	let revealed = $state<Record<string, boolean>>({});

	function initialInputs(): Record<string, number> {
		const seed: Record<string, number> = {};
		for (const input of manifest.inputs) {
			seed[input.key] = input.kind === 'toggle' ? (input.initial ? 1 : 0) : input.initial;
		}
		return seed;
	}

	function initialFaults(): Record<string, boolean> {
		const seed: Record<string, boolean> = {};
		for (const fault of manifest.faults) seed[fault.key] = false;
		return seed;
	}

	const model = $derived(resolveLabModel(manifest.model));
	const rows = $derived(expandBindings(manifest.bindings));

	const frame = $derived(
		model ? model({ inputs, faults, step: timeline.step }) : { signals: {}, notes: [] }
	);

	/** A signal counts as on at or above the binding's threshold. */
	function on(signal: string, threshold: number): boolean {
		return (frame.signals[signal] ?? 0) >= threshold;
	}

	/* One paint per frame, driven entirely by the manifest's bindings. */
	$effect(() => {
		const root = host;
		if (!root) return;
		for (const row of rows) {
			const live = on(row.signal, row.threshold);
			if (row.node !== undefined) {
				if (row.as === 'degraded') setNodeDegraded(root, row.node, live);
				else setNodeActive(root, row.node, live);
			}
			if (row.wire !== undefined) {
				/* `high` asks for the logic-1 treatment; anything else is the plain
				   carries-signal class the electrical labs use. */
				if (row.as === 'high') setNetLevel(root, row.wire, live ? 'high' : 'off');
				else setWiresFrom(root, row.wire, live);
			}
		}
	});

	/* Append one scope sample per committed run, not per repaint. */
	let lastRun = -1;
	$effect(() => {
		const runId = timeline.runId;
		const channel = manifest.instruments.find((item) => item.kind === 'scope');
		if (!channel || channel.kind !== 'scope' || runId === lastRun) return;
		lastRun = runId;
		const value = frame.signals[channel.signal] ?? 0;
		scope = [...scope.slice(1), value > 0 ? 0.85 : 0.15];
	});

	/* A fault's explanation stays hidden until the reader has engaged it, and
	   stays visible afterwards — the diagnosis is the exercise, but re-hiding
	   the answer the moment they switch it back would just be a memory test. */
	$effect(() => {
		for (const fault of manifest.faults) {
			if (faults[fault.key] === true && revealed[fault.key] !== true) {
				revealed[fault.key] = true;
			}
		}
	});

	function bitsOf(template: string, count: number, from = 0): number[] {
		return Array.from({ length: count }, (_, offset) => {
			const index = from + offset;
			const key = template.includes('{i}') ? fillIndex(template, index) : `${template}${index}`;
			return frame.signals[key] ?? 0;
		});
	}

	function present(value: number, format?: string, unit?: string): string {
		const text =
			format === 'fixed2'
				? value.toFixed(2)
				: format === 'percent'
					? `${(value * 100).toFixed(1)}%`
					: Math.round(value).toLocaleString('en-US');
		return unit ? `${text} ${unit}` : text;
	}
</script>

{#if !model}
	<p class="lab-error" role="alert">
		This laboratory names the model <code>{manifest.model}</code>, which is not registered. A
		manifest can only select a model the application already ships.
	</p>
{:else}
	<LabShell>
		{#snippet controls()}
			{#each manifest.inputs as input (input.key)}
				<label class="control">
					<span class="microlabel">{input.label}</span>
					{#if input.kind === 'toggle'}
						<input
							type="checkbox"
							checked={inputs[input.key] === 1}
							onchange={(event) => (inputs[input.key] = event.currentTarget.checked ? 1 : 0)}
						/>
					{:else if input.kind === 'slider'}
						<input
							type="range"
							min={input.min}
							max={input.max}
							step={input.step}
							value={inputs[input.key]}
							oninput={(event) => (inputs[input.key] = event.currentTarget.valueAsNumber)}
						/>
						<span class="readout">{present(inputs[input.key] ?? 0, 'fixed2', input.unit)}</span>
					{:else}
						<input
							type="number"
							min={input.min}
							max={input.max}
							value={inputs[input.key]}
							oninput={(event) => (inputs[input.key] = event.currentTarget.valueAsNumber)}
						/>
					{/if}
				</label>
			{/each}

			{#each manifest.faults as fault (fault.key)}
				<div class="fault">
					<FaultSwitch label={fault.label} bind:active={faults[fault.key]} />
					{#if revealed[fault.key]}
						<p class="reveal">{fault.reveal}</p>
					{/if}
				</div>
			{/each}
		{/snippet}

		{#snippet canvas()}
			<div class="sim-stage" bind:this={host}>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiler output -->
				{@html svg}
			</div>
		{/snippet}

		{#snippet instruments()}
			{#each manifest.instruments as instrument (instrument.label)}
				<section class="instrument">
					<p class="microlabel">{instrument.label}</p>
					{#if instrument.kind === 'readout'}
						<span class="readout big">
							{present(frame.signals[instrument.signal] ?? 0, instrument.format, instrument.unit)}
						</span>
					{:else if instrument.kind === 'bits'}
						<ol class="bits">
							{#each bitsOf(instrument.signal, instrument.count, instrument.from) as bit, index (index)}
								<li class:high={bit >= 1}>{bit >= 1 ? 1 : 0}</li>
							{/each}
						</ol>
					{:else}
						<Oscilloscope samples={scope} />
					{/if}
				</section>
			{/each}

			{#each frame.notes ?? [] as note (note)}
				<p class="note">{note}</p>
			{/each}
		{/snippet}
	</LabShell>
{/if}

<style>
	.control {
		display: grid;
		gap: var(--space-1);
	}

	.fault {
		display: grid;
		gap: var(--space-2);
	}

	.reveal {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.instrument {
		display: grid;
		gap: var(--space-1);
	}

	.bits {
		display: flex;
		gap: 2px;
		list-style: none;
		margin: 0;
		padding: 0;

		& li {
			inline-size: 1.6rem;
			text-align: center;
			padding-block: var(--space-1);
			font-family: var(--font-mono);
			background: color-mix(in srgb, var(--ink) 7%, transparent);
			color: var(--ink-faint);
			border-radius: var(--radius-sm);
		}

		& li.high {
			background: color-mix(in srgb, var(--accent) 22%, transparent);
			color: var(--ink);
		}
	}

	.note {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}

	.lab-error {
		padding: var(--space-4);
		border: 1px solid var(--danger);
		border-radius: var(--radius-sm);
		color: var(--ink);
	}
</style>
