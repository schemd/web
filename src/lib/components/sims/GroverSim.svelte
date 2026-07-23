<script lang="ts">
	/**
	 * Grover's algorithm over N = 8 basis states (3 qubits), as a step-by-step
	 * transformation inspector.
	 *
	 * The whole run is a pure function of the `step` index, so Previous/Next jump
	 * instantly with no async state: uniform superposition, then per round an
	 * oracle phase-flip, the mean-line calculation, and the diffuser inversion,
	 * ending in measurement. Amplitudes are real and **signed** — the target dips
	 * below the resting plane after the oracle and rebounds above the mean after
	 * the diffuser. The active gate lights in the compiled circuit and a HUD shows
	 * the exact transformation for the current step.
	 */
	import { setNodeActive, setWiresFrom, delegatedNodeId } from '$lib/sim-dom';
	import {
		SIMULATION_TIMELINE_EVENT,
		type SimulationTimelineDetail
	} from '$lib/simulation-timelines';
	import { playSuccess, playTick } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';
	import LabShell from './LabShell.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import ProbeHud from './ProbeHud.svelte';
	import LiveMath from './LiveMath.svelte';
	import { reading, type MathReading } from '$lib/simulation-math';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	const N = 8;
	const UNIFORM = 1 / Math.sqrt(N);
	const OPTIMAL = Math.floor((Math.PI / 4) * Math.sqrt(N)); /* = 2 for N = 8 */

	type PhaseKind = 'super' | 'oracle' | 'mean' | 'diffuse' | 'measure';
	interface Phase {
		readonly kind: PhaseKind;
		readonly round: number;
		readonly label: string;
	}

	/** The full staged schedule: superposition, k×(oracle, mean, diffuse), measure. */
	const PHASES: readonly Phase[] = (() => {
		const list: Phase[] = [{ kind: 'super', round: 0, label: 'Superposition' }];
		for (let round = 1; round <= OPTIMAL; round += 1) {
			list.push({ kind: 'oracle', round, label: `Round ${round} · Oracle U_f` });
			list.push({ kind: 'mean', round, label: `Round ${round} · Mean ⟨a⟩` });
			list.push({ kind: 'diffuse', round, label: `Round ${round} · Diffuser` });
		}
		list.push({ kind: 'measure', round: OPTIMAL, label: 'Measurement' });
		return list;
	})();
	let host = $state<HTMLElement | undefined>();
	let target = $state(0b101); /* the marked item; set by the 3 qubit toggles */
	let step = $state(0);
	let faults = $state({ wrongOracle: false });

	const markedIndex = $derived(faults.wrongOracle ? target ^ 0b001 : target);
	const label = (index: number): string => index.toString(2).padStart(3, '0');

	/** The exact state after replaying every phase up to (and including) `step`. */
	const stepState = $derived.by(() => {
		const marked = markedIndex;
		let amplitudes = Array.from({ length: N }, () => UNIFORM);
		for (let index = 1; index <= step; index += 1) {
			const kind = PHASES[index]!.kind;
			if (kind === 'oracle') {
				amplitudes = amplitudes.map((a, i) => (i === marked ? -a : a));
			} else if (kind === 'diffuse') {
				const mean = amplitudes.reduce((sum, a) => sum + a, 0) / N;
				amplitudes = amplitudes.map((a) => 2 * mean - a);
			}
		}
		const phase = PHASES[step]!;
		/* The mean line is the reflection axis shown at the dedicated mean step. */
		const mean = phase.kind === 'mean' ? amplitudes.reduce((sum, a) => sum + a, 0) / N : undefined;
		return { amplitudes, mean, phase };
	});

	const amplitudes = $derived(stepState.amplitudes);
	const currentPhase = $derived(stepState.phase);
	const meanValue = $derived(stepState.mean);
	const pTarget = $derived(amplitudes[target]! ** 2);

	/* Restart the walk whenever the marked state or the oracle fault changes. */
	$effect(() => {
		void target;
		void faults.wrongOracle;
		step = 0;
	});

	/* Keep the mathematical replay synchronized with the shared SVG timeline. */
	$effect(() => {
		const onStage = (event: Event): void => {
			const detail = (event as CustomEvent<SimulationTimelineDetail>).detail;
			if (detail.simulationId !== 'grover') return;
			step = Math.max(0, Math.min(PHASES.length - 1, detail.step));
			onStep(step);
		};
		window.addEventListener(SIMULATION_TIMELINE_EVENT, onStage);
		return () => window.removeEventListener(SIMULATION_TIMELINE_EVENT, onStage);
	});

	/** Toggle one bit of the target. */
	function toggleTargetBit(bit: number): void {
		target ^= 1 << bit;
		if (ui.audio) playTick(500 + bit * 60);
	}

	/* Per-step audit chime + a success chime when the optimum measurement lands. */
	function onStep(next: number): void {
		if (!ui.audio) return;
		if (PHASES[next]!.kind === 'measure' && !faults.wrongOracle) playSuccess();
		else playTick(480 + next * 40);
	}

	/* ---------- Signed amplitude bar geometry ---------- */
	const CHART_W = 244;
	const CHART_H = 150;
	const ZERO_Y = 98; /* the resting plane */
	const SCALE = 80; /* px per unit amplitude */
	const barX = (index: number): number => 12 + index * 29;
	const barTop = (a: number): number => (a >= 0 ? ZERO_Y - a * SCALE : ZERO_Y);
	const barHeight = (a: number): number => Math.abs(a) * SCALE;
	const meanY = $derived(meanValue === undefined ? ZERO_Y : ZERO_Y - meanValue * SCALE);

	/** The live math for the current step, shown in the HUD. */
	const hudMath = $derived.by<MathReading>(() => {
		switch (currentPhase.kind) {
			case 'super':
				return reading(
					'grover.hud.super',
					`uniform superposition, every amplitude ${UNIFORM.toFixed(3)}`,
					{ amplitude: `+${UNIFORM.toFixed(3)}` }
				);
			case 'oracle':
				return reading('grover.hud.oracle', `oracle phase flips state ${label(markedIndex)}`, {
					state: label(markedIndex),
					state2: label(markedIndex)
				});
			case 'mean':
				return reading('grover.hud.mean', `mean amplitude ${(meanValue ?? 0).toFixed(3)}`, {
					value: (meanValue ?? 0).toFixed(3)
				});
			case 'diffuse':
				return reading(
					'grover.hud.diffuse',
					`diffusion raises target probability to ${(pTarget * 100).toFixed(1)} percent`,
					{ state: label(target), probability: (pTarget * 100).toFixed(1) }
				);
			case 'measure':
				return reading(
					'grover.hud.measure',
					`measurement probability ${(pTarget * 100).toFixed(1)} percent for state ${label(target)}`,
					{ state: label(target), probability: (pTarget * 100).toFixed(1) }
				);
		}
	});

	/* Light the gate that corresponds to the active step in the compiled circuit. */
	$effect(() => {
		const root = host;
		if (!root) return;
		const kind = currentPhase.kind;
		for (let i = 0; i < 3; i += 1) {
			const inputHigh = ((target >> i) & 1) === 1;
			setNodeActive(root, `Q${i}`, inputHigh);
			setWiresFrom(root, `Q${i}.out`, inputHigh);
			setNodeActive(root, `H${i}`, kind === 'super');
		}
		setNodeActive(root, 'ORACLE', kind === 'oracle');
		setNodeActive(root, 'DIFF', kind === 'mean' || kind === 'diffuse');
		for (let i = 0; i < 3; i += 1) setNodeActive(root, `M${i}`, kind === 'measure');
	});

	function probe(element: Element): MathReading | undefined {
		const id = delegatedNodeId(element);
		if (id === 'ORACLE')
			return reading('grover.probe.oracle', `oracle marks state ${label(markedIndex)}`, {
				state: label(markedIndex)
			});
		if (id === 'DIFF')
			return reading('grover.probe.diffuse', 'diffusion reflects each amplitude about the mean');
		const measure = id?.match(/^M(\d)$/);
		if (measure)
			return reading(
				'grover.probe.measure',
				`qubit ${measure[1]}, target probability ${(pTarget * 100).toFixed(1)} percent`,
				{ qubit: measure[1]!, probability: (pTarget * 100).toFixed(1) }
			);
		const hadamard = id?.match(/^H(\d)$/);
		if (hadamard)
			return reading('grover.probe.h', `Hadamard on qubit ${hadamard[1]}`, { qubit: hadamard[1]! });
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="stack">
		<p class="control-note">
			Mark one of the eight states, then <strong>step</strong> the register toward it. Each round is an
			oracle phase-flip, a mean reflection, and a diffuser rebound — watch the target grow.
		</p>
		<div class="target-picker">
			<span class="microlabel"
				><LiveMath
					id="grover.control.target"
					label={`marked state ${label(target)}`}
					values={{ value: label(target) }}
				/></span
			>
			<div class="qubits">
				{#each [2, 1, 0] as bit (bit)}
					<button
						type="button"
						class="qubit"
						class:on={((target >> bit) & 1) === 1}
						onclick={() => toggleTargetBit(bit)}
						aria-pressed={((target >> bit) & 1) === 1}
					>
						{(target >> bit) & 1}
					</button>
				{/each}
				<span class="target-ket"
					><LiveMath
						id="grover.control.target"
						label={`marked state ${label(target)}`}
						values={{ value: label(target) }}
					/></span
				>
			</div>
		</div>
	</div>
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="oracle marks the wrong state" bind:active={faults.wrongOracle} />
	</div>
{/snippet}

{#snippet canvas()}
	<div
		class="sim-stage schemd-frame net-optics"
		bind:this={host}
		role="group"
		aria-label="Grover 3-qubit search circuit"
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<div class="hud" aria-live="polite">
		<span class="microlabel">{currentPhase.label}</span>
		<p class="hud-math">
			<LiveMath id={hudMath.id} label={hudMath.label} values={hudMath.values} />
		</p>
	</div>
	<svg
		class="bars"
		viewBox={`0 0 ${CHART_W} ${CHART_H}`}
		role="img"
		aria-label="Signed amplitude bars"
	>
		<!-- resting plane (amplitude 0) -->
		<line class="zero-line" x1="4" x2={CHART_W - 4} y1={ZERO_Y} y2={ZERO_Y} />
		<!-- uniform reference -->
		<line
			class="uniform-line"
			x1="4"
			x2={CHART_W - 4}
			y1={ZERO_Y - UNIFORM * SCALE}
			y2={ZERO_Y - UNIFORM * SCALE}
		/>
		{#each amplitudes as amplitude, index (index)}
			<rect
				class="bar"
				class:target={index === target}
				class:negative={amplitude < 0}
				x={barX(index)}
				y={barTop(amplitude)}
				width="20"
				height={barHeight(amplitude)}
			/>
			<text class="bar-label" x={barX(index) + 10} y={CHART_H - 4}>{label(index)}</text>
		{/each}
		<!-- mean reflection axis (shown at the mean step) -->
		{#if meanValue !== undefined}
			<line class="mean-line" x1="4" x2={CHART_W - 4} y1={meanY} y2={meanY} />
			<text class="mean-label" x={CHART_W - 6} y={meanY - 3}>mean</text>
		{/if}
	</svg>
	<div class="legend microlabel">
		<span><i class="sw target"></i> target</span>
		<span><i class="sw"></i> others</span>
		<span class="peak" class:hit={pTarget > 0.9}
			><LiveMath
				id="grover.readout.peak"
				label={`probability ${(pTarget * 100).toFixed(1)} percent`}
				values={{ value: (pTarget * 100).toFixed(1) }}
			/></span
		>
	</div>
{/snippet}

<style>
	.stack,
	.switchboard {
		display: grid;
		gap: var(--space-2);
	}

	.control-note {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);

		& strong {
			color: var(--ink);
			font-weight: 600;
		}
	}

	.target-picker {
		display: grid;
		gap: var(--space-2);
	}

	.qubits {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.qubit {
		inline-size: 2.2rem;
		block-size: 2.2rem;
		font-family: var(--font-mono);
		font-size: var(--text-md);
		border: 1px solid var(--line-strong);
		background: var(--bg-inset);
		color: var(--ink-faint);
		transition:
			color var(--dur-fast) var(--ease-precise),
			background-color var(--dur-fast) var(--ease-precise);

		&.on {
			color: var(--accent-ink);
			background: var(--accent);
			border-color: var(--accent);
		}
	}

	.target-ket {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--accent-2);
	}

	/* ---------- HUD ---------- */
	.hud {
		display: grid;
		gap: 2px;
		padding: var(--space-3);
		border: 1px solid var(--line-strong);
		border-inline-start: 3px solid var(--accent);
		background: var(--bg-inset);
	}

	.hud-math {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		line-height: 1.5;
		color: var(--ink);
	}

	/* ---------- Signed bar chart ---------- */
	.bars {
		inline-size: 100%;
		max-inline-size: 260px;
		background: var(--bg-inset);
		border: 1px solid var(--line);
	}

	.zero-line {
		stroke: var(--line-strong);
		stroke-width: 0.8;
	}

	.uniform-line {
		stroke: var(--ink-faint);
		stroke-width: 0.6;
		stroke-dasharray: 2 3;
		opacity: 0.6;
	}

	.mean-line {
		stroke: var(--warn, var(--accent-2));
		stroke-width: 1;
		stroke-dasharray: 4 2;
	}

	.mean-label {
		fill: var(--warn, var(--accent-2));
		font-family: var(--font-mono);
		font-size: 8px;
		text-anchor: end;
	}

	.bar {
		fill: var(--ink-faint);
		opacity: 0.7;
		transition:
			y var(--dur-med) var(--ease-precise),
			height var(--dur-med) var(--ease-precise),
			fill var(--dur-med) var(--ease-precise);
	}

	.bar.target {
		fill: var(--accent);
		opacity: 1;
	}

	.bar.negative {
		fill: var(--danger);
		opacity: 0.85;
	}

	.bar.target.negative {
		fill: var(--danger);
		opacity: 1;
	}

	.bar-label {
		fill: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 7px;
		text-anchor: middle;
	}

	.legend {
		display: flex;
		align-items: center;
		gap: var(--space-3);

		& .sw {
			display: inline-block;
			inline-size: 9px;
			block-size: 9px;
			margin-inline-end: 3px;
			vertical-align: -1px;
			background: var(--ink-faint);
		}

		& .sw.target {
			background: var(--accent);
		}

		& .peak {
			margin-inline-start: auto;
			font-family: var(--font-mono);
			color: var(--ink-mute);
		}

		& .peak.hit {
			color: var(--ok);
		}
	}

	.sim-stage {
		:global(svg) {
			min-inline-size: 1180px;
		}
	}
</style>
