<script lang="ts">
	/**
	 * Quantum teleportation protocol tracker.
	 *
	 * The input state |ψ⟩ = α|0⟩ + β|1⟩ is parameterized on the Bloch angles
	 * (α = cos θ/2, β = e^{iφ} sin θ/2). Stepping the protocol advances the
	 * register through entanglement, Bell measurement, and the classically
	 * controlled X^{m₂}/Z^{m₁} corrections; hovering any gate reveals its
	 * action in Dirac notation inside a floating HUD.
	 */
	import { delegatedNodeId, setNodeActive, setNodeDegraded } from '$lib/sim-dom';
	import { playTick, playSuccess } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';
	import Oscilloscope from './Oscilloscope.svelte';
	import LabShell from './LabShell.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import ProbeHud from './ProbeHud.svelte';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	let host = $state<HTMLElement | undefined>();
	let theta = $state(Math.PI / 3);
	let phi = $state(Math.PI / 4);
	let step = $state(0);
	let m1 = $state<number | undefined>();
	let m2 = $state<number | undefined>();
	let hover = $state<{ x: number; y: number; math: string } | undefined>();
	let faults = $state({ lostClassicalBit: false });
	let playing = $state(false);
	let scopeAlpha = $state<number[]>([]);
	let scopeBeta = $state<number[]>([]);
	let wavePhase = $state(0);

	const alpha = $derived(Math.cos(theta / 2));
	const betaMagnitude = $derived(Math.sin(theta / 2));
	const betaReal = $derived(betaMagnitude * Math.cos(phi));
	const betaImaginary = $derived(betaMagnitude * Math.sin(phi));
	const p0 = $derived(alpha * alpha);
	const p1 = $derived(betaMagnitude * betaMagnitude);

	const betaText = $derived(
		`${betaReal.toFixed(3)}${betaImaginary >= 0 ? ' + ' : ' − '}${Math.abs(betaImaginary).toFixed(3)}i`
	);

	const STEPS = [
		{ id: 0, label: 'initialize', active: ['PSI', 'A', 'B'] },
		{ id: 1, label: 'entangle A↔B', active: ['H1', 'CX1'] },
		{ id: 2, label: 'Bell basis on ψ,A', active: ['CX2', 'H2'] },
		{ id: 3, label: 'measure m₁, m₂', active: ['MZ1', 'MZ2'] },
		{ id: 4, label: 'apply X^{m₂}, Z^{m₁}', active: ['XC', 'ZC'] },
		{ id: 5, label: '|ψ⟩ reconstructed', active: ['OUT'] }
	] as const;

	/**
	 * Bob's fidelity F = |⟨ψ|ψ_out⟩|². With the classical link intact he applies
	 * X^{m₂}Z^{m₁} and recovers |ψ⟩ exactly (F = 1). If the link is cut he applies
	 * the identity, so he is left holding X^{m₂}Z^{m₁}|ψ⟩ — and the overlap with
	 * the original depends on which random outcomes occurred.
	 */
	const fidelity = $derived.by(() => {
		if (step < 4) return undefined;
		if (!faults.lostClassicalBit) return 1;
		const mm1 = m1 ?? 0;
		const mm2 = m2 ?? 0;
		if (mm1 === 0 && mm2 === 0) return 1; /* no correction needed */
		if (mm1 === 1 && mm2 === 0) return (alpha * alpha - betaMagnitude * betaMagnitude) ** 2;
		if (mm1 === 0 && mm2 === 1) return (2 * alpha * betaReal) ** 2;
		return (2 * alpha * betaImaginary) ** 2; /* X·Z uncorrected */
	});
	const corrupted = $derived(fidelity !== undefined && fidelity < 0.999);

	function advance(): void {
		if (step >= 5) {
			reset();
			return;
		}
		step += 1;
		if (step === 3) {
			/* Bell-measurement outcomes are uniform — each pair with P = 1/4. */
			m1 = Math.random() < 0.5 ? 0 : 1;
			m2 = Math.random() < 0.5 ? 0 : 1;
		}
		if (ui.audio) {
			if (step === 5) playSuccess();
			else playTick(480 + step * 60);
		}
	}

	function reset(): void {
		step = 0;
		m1 = undefined;
		m2 = undefined;
		playing = false;
	}

	/* Auto-playback: advance one step per beat, then latch at reconstruction. */
	$effect(() => {
		if (!playing) return;
		const beat = setInterval(() => {
			if (step >= 5) playing = false;
			else advance();
		}, 1100);
		return () => clearInterval(beat);
	});

	$effect(() => {
		const root = host;
		if (!root) return;
		const activeNow = new Set(STEPS[step]?.active ?? []);
		const all = [
			'PSI',
			'A',
			'B',
			'H1',
			'CX1',
			'CX2',
			'H2',
			'MZ1',
			'MZ2',
			'XC',
			'ZC',
			'OUT'
		] as const;
		for (const id of all) {
			setNodeActive(root, id, activeNow.has(id));
			setNodeDegraded(root, id, false);
		}
		if (faults.lostClassicalBit) {
			setNodeDegraded(root, 'XC', true);
			setNodeDegraded(root, 'ZC', true);
		}
	});

	/* 60 FPS phasor scope: α reference (real) vs β at phase φ. */
	$effect(() => {
		let frame = 0;
		const loop = (): void => {
			wavePhase += 0.05;
			const points = 96;
			const nextAlpha: number[] = [];
			const nextBeta: number[] = [];
			for (let index = 0; index < points; index += 1) {
				const t = (index / points) * Math.PI * 4 + wavePhase;
				nextAlpha.push(0.5 + 0.42 * alpha * Math.cos(t));
				nextBeta.push(0.5 + 0.42 * betaMagnitude * Math.cos(t + phi));
			}
			scopeAlpha = nextAlpha;
			scopeBeta = nextBeta;
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	const GATE_MATH: Record<string, () => string> = {
		PSI: () => `|ψ⟩ = ${alpha.toFixed(3)}|0⟩ + (${betaText})|1⟩`,
		H1: () => 'H|0⟩ = (|0⟩ + |1⟩)/√2',
		CX1: () => 'CNOT: (|00⟩ + |10⟩)/√2 → (|00⟩ + |11⟩)/√2 = |Φ⁺⟩',
		CX2: () => 'CNOT(ψ→A): |a⟩|b⟩ → |a⟩|b ⊕ a⟩',
		H2: () => 'H rotates ψ into the Bell basis before measurement',
		MZ1: () => `M_Z on ψ → m₁ ${m1 === undefined ? '∈ {0,1}' : `= ${m1}`}`,
		MZ2: () => `M_Z on A → m₂ ${m2 === undefined ? '∈ {0,1}' : `= ${m2}`}`,
		XC: () =>
			`X^{m₂}: applied ${m2 === undefined ? 'iff m₂ = 1' : m2 === 1 ? '(m₂ = 1 → flip)' : '(m₂ = 0 → identity)'}`,
		ZC: () =>
			`Z^{m₁}: applied ${m1 === undefined ? 'iff m₁ = 1' : m1 === 1 ? '(m₁ = 1 → phase flip)' : '(m₁ = 0 → identity)'}`,
		OUT: () =>
			`Bob holds α|0⟩ + β|1⟩ — fidelity F = ${fidelity === undefined ? '…' : fidelity.toFixed(3)}`
	};

	function onStageMove(event: PointerEvent): void {
		if (!(event.target instanceof Element)) return;
		const id = delegatedNodeId(event.target);
		const math = id ? GATE_MATH[id]?.() : undefined;
		hover = math ? { x: event.clientX, y: event.clientY, math } : undefined;
	}

	function probe(element: Element): string | undefined {
		const id = delegatedNodeId(element);
		if (!id) return undefined;
		if (id === 'PSI' || id === 'OUT') {
			return `α = ${alpha.toFixed(3)} · β = ${betaText} · P(0) = ${p0.toFixed(3)}, P(1) = ${p1.toFixed(3)}`;
		}
		return GATE_MATH[id]?.();
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="controls">
		<label>
			<span class="microlabel">θ = {(theta / Math.PI).toFixed(2)}π</span>
			<input type="range" min="0" max={Math.PI} step="0.01" bind:value={theta} aria-label="Theta" />
		</label>
		<label>
			<span class="microlabel">φ = {(phi / Math.PI).toFixed(2)}π</span>
			<input type="range" min="0" max={Math.PI * 2} step="0.01" bind:value={phi} aria-label="Phi" />
		</label>
		<p class="readout">|ψ⟩ = {alpha.toFixed(3)}|0⟩ + ({betaText})|1⟩</p>
	</div>

	<div class="playback">
		<p class="microlabel">protocol playback</p>
		<div class="transport">
			<button type="button" class="btn" onclick={advance} disabled={playing} title="Step forward">
				step ⏭
			</button>
			<button
				type="button"
				class="btn"
				aria-pressed={playing}
				onclick={() => {
					if (step >= 5) reset();
					playing = !playing;
				}}
				title={playing ? 'Pause' : 'Play'}
			>
				{playing ? 'pause ⏸' : 'play ⏵'}
			</button>
			<button type="button" class="btn" onclick={reset} title="Reset state">reset ⭯</button>
		</div>
		<ol class="steps">
			{#each STEPS as protocolStep (protocolStep.id)}
				<li class:done={step >= protocolStep.id} class:now={step === protocolStep.id}>
					{protocolStep.label}
					{#if protocolStep.id === 3 && m1 !== undefined}
						· m₁={m1}, m₂={m2}
					{/if}
				</li>
			{/each}
		</ol>
	</div>

	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="classical correction link cut" bind:active={faults.lostClassicalBit} />
	</div>
{/snippet}

{#snippet canvas()}
	<div
		class="sim-stage schemd-frame"
		bind:this={host}
		onpointermove={onStageMove}
		onpointerleave={() => (hover = undefined)}
		role="group"
		aria-label="Quantum teleportation register. Hover gates for their Dirac-notation action."
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<div class="readouts">
		<span class="readout">P(0) = {p0.toFixed(3)}</span>
		<span class="readout">P(1) = {p1.toFixed(3)}</span>
	</div>
	<div class="fidelity" class:ok={fidelity !== undefined && !corrupted} class:bad={corrupted}>
		<span class="microlabel">teleportation fidelity · F = |⟨ψ|ψ_out⟩|²</span>
		<div class="fid-bar">
			<span style={`width: ${(fidelity ?? 0) * 100}%`}></span>
		</div>
		<div class="fid-legend">
			<strong>F = {fidelity === undefined ? '—' : fidelity.toFixed(3)}</strong>
			<span>
				{fidelity === undefined
					? 'run the protocol'
					: corrupted
						? 'correction lost — state degraded'
						: 'state reconstructed exactly'}
			</span>
		</div>
	</div>
	<Oscilloscope
		channels={[
			{ samples: scopeAlpha, name: 'α' },
			{ samples: scopeBeta, name: 'β∠φ' }
		]}
		label="state phasor"
	/>
{/snippet}

{#if hover}
	<output class="math-hud" style={`transform: translate(${hover.x + 16}px, ${hover.y + 12}px)`}>
		{hover.math}
	</output>
{/if}

<style>
	.controls,
	.playback,
	.switchboard {
		display: grid;
		gap: var(--space-2);

		& label {
			display: grid;
			gap: 2px;
		}

		& input[type='range'] {
			accent-color: var(--accent);
		}
	}

	.controls .readout {
		margin: 0;
	}

	.transport {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);

		& .btn[aria-pressed='true'] {
			border-color: var(--accent);
			color: var(--accent);
		}
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-faint);

		& li {
			padding-block: 1px;

			&::before {
				content: '○ ';
			}

			&.done {
				color: var(--ink-mute);

				&::before {
					content: '● ';
					color: var(--ok);
				}
			}

			&.now {
				color: var(--accent);
			}
		}
	}

	.readouts {
		display: grid;
		gap: var(--space-1);
	}

	.bad {
		color: var(--danger);
	}

	.fidelity {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-3);
		border: 1px solid var(--line-strong);
		background: var(--bg-inset);

		&.ok {
			border-color: var(--ok);
		}

		&.bad {
			border-color: var(--danger);
		}
	}

	.fid-bar {
		block-size: 6px;
		background: var(--bg-panel);
		border: 1px solid var(--line);

		& span {
			display: block;
			block-size: 100%;
			background: var(--ok);
			transition: width var(--dur-med) var(--ease-precise);
		}
	}

	.fidelity.bad .fid-bar span {
		background: var(--danger);
	}

	.fid-legend {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-mute);

		& strong {
			color: var(--ok);
		}
	}

	.fidelity.bad .fid-legend strong {
		color: var(--danger);
	}

	.sim-stage {
		cursor: crosshair;
	}

	.math-hud {
		position: fixed;
		inset-block-start: 0;
		inset-inline-start: 0;
		z-index: 80;
		pointer-events: none;
		padding: 0.35rem 0.65rem;
		background: var(--bg-panel);
		border: 1px solid var(--accent-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--accent-2);
		white-space: nowrap;
		will-change: transform;
	}
</style>
