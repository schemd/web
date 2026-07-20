<script lang="ts">
	/** Chua oscillator: RK4 integration, shadow-orbit divergence, and a live x–y phase portrait. */
	import {
		delegatedNodeId,
		delegatedWireSource,
		setNodeActive,
		setNodeDegraded,
		styleWiresFrom
	} from '$lib/sim-dom';
	import { playTick } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import LabShell from './LabShell.svelte';
	import Oscilloscope from './Oscilloscope.svelte';
	import PhasePortrait from './PhasePortrait.svelte';
	import ProbeHud from './ProbeHud.svelte';

	interface Props {
		svg: string;
	}
	type StateVector = readonly [number, number, number];
	type Point = { x: number; y: number };
	let { svg }: Props = $props();

	let host = $state<HTMLElement | undefined>();
	let alpha = $state(15.6);
	let beta = $state(28);
	let m0 = $state(-1.143);
	let m1 = $state(-0.714);
	let timeScale = $state(1);
	let trajectory = $state<StateVector>([0.11, 0, 0]);
	let shadow = $state<StateVector>([0.11001, 0, 0]);
	let orbit = $state<Point[]>([]);
	let scopeX = $state<number[]>([]);
	let scopeY = $state<number[]>([]);
	let lyapunov = $state(0);
	let paused = $state(false);
	let faults = $state({ bypassedNonlinearity: false });
	let bifurcation = $state<{ a: number; x: number }[]>([]);
	let computingBif = $state(false);

	const regime = $derived.by(() => {
		if (faults.bypassedNonlinearity) return 'DAMPED LINEAR';
		if (lyapunov > 0.035 && orbit.length > 80) return 'CHAOTIC';
		if (alpha < 9) return 'FIXED-POINT';
		if (alpha < 11) return 'LIMIT CYCLE';
		return 'TRANSIENT / CHAOTIC';
	});

	function nonlinearity(x: number): number {
		if (faults.bypassedNonlinearity) return x;
		return m1 * x + 0.5 * (m0 - m1) * (Math.abs(x + 1) - Math.abs(x - 1));
	}

	function derivative([x, y, z]: StateVector): StateVector {
		return [alpha * (y - x - nonlinearity(x)), x - y + z, -beta * y];
	}

	function add(base: StateVector, slope: StateVector, scale: number): StateVector {
		return [base[0] + slope[0] * scale, base[1] + slope[1] * scale, base[2] + slope[2] * scale];
	}

	function rk4(value: StateVector, dt: number): StateVector {
		const k1 = derivative(value);
		const k2 = derivative(add(value, k1, dt / 2));
		const k3 = derivative(add(value, k2, dt / 2));
		const k4 = derivative(add(value, k3, dt));
		return [
			value[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
			value[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
			value[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])
		];
	}

	const BIF_MIN = 7;
	const BIF_MAX = 18;

	/**
	 * Sweep the coupling α and record where the orbit turns around (local maxima
	 * of x). One stable point gives one dot per α; period-doubling splits it into
	 * 2, 4, …; chaos scatters a cloud — the classic route-to-chaos diagram.
	 */
	function computeBifurcation(): void {
		computingBif = true;
		/* Defer so the "computing…" state paints before the synchronous sweep. */
		setTimeout(() => {
			const points: { a: number; x: number }[] = [];
			const dt = 0.006;
			const columns = 130;
			for (let column = 0; column <= columns; column += 1) {
				const sweepAlpha = BIF_MIN + ((BIF_MAX - BIF_MIN) * column) / columns;
				let state: StateVector = [0.1, 0, 0];
				for (let step = 0; step < 1800; step += 1) state = rk4WithAlpha(state, dt, sweepAlpha);
				let previousSlope = 0;
				let recorded = 0;
				for (let step = 0; step < 4200 && recorded < 24; step += 1) {
					const next = rk4WithAlpha(state, dt, sweepAlpha);
					const slope = next[0] - state[0];
					if (previousSlope > 0 && slope <= 0 && Number.isFinite(state[0])) {
						points.push({ a: sweepAlpha, x: state[0] });
						recorded += 1;
					}
					previousSlope = slope;
					state = next;
				}
			}
			bifurcation = points;
			computingBif = false;
			if (ui.audio) playTick(620);
		}, 30);
	}

	/** RK4 step at an explicit α (β, m₀, m₁ from the live controls). */
	function rk4WithAlpha(value: StateVector, dt: number, sweepAlpha: number): StateVector {
		const f = ([x, y, z]: StateVector): StateVector => [
			sweepAlpha * (y - x - nonlinearity(x)),
			x - y + z,
			-beta * y
		];
		const k1 = f(value);
		const k2 = f(add(value, k1, dt / 2));
		const k3 = f(add(value, k2, dt / 2));
		const k4 = f(add(value, k3, dt));
		return [
			value[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
			value[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
			value[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])
		];
	}

	/** Bifurcation scatter as one dotted path (round caps draw the points). */
	const bifurcationPath = $derived.by(() => {
		if (bifurcation.length === 0) return '';
		const W = 240;
		const H = 150;
		let d = '';
		for (const point of bifurcation) {
			const px = ((point.a - BIF_MIN) / (BIF_MAX - BIF_MIN)) * W;
			const py = H / 2 - (Math.max(-4, Math.min(4, point.x)) / 4) * (H / 2 - 4);
			d += `M ${px.toFixed(1)} ${py.toFixed(1)} l 0.01 0 `;
		}
		return d;
	});
	const alphaMarker = $derived(((alpha - BIF_MIN) / (BIF_MAX - BIF_MIN)) * 240);

	function reset(next: StateVector = [0.11, 0, 0]): void {
		trajectory = next;
		shadow = [next[0] + 0.00001, next[1], next[2]];
		orbit = [];
		scopeX = [];
		scopeY = [];
		lyapunov = 0;
		if (ui.audio) playTick(500);
	}

	function perturb(): void {
		reset([
			trajectory[0] + (Math.random() - 0.5) * 0.04,
			trajectory[1] + (Math.random() - 0.5) * 0.02,
			trajectory[2]
		]);
	}

	$effect(() => {
		let frame = 0;
		const loop = (): void => {
			if (!paused) {
				const dt = 0.0045 * timeScale;
				let next = trajectory;
				let nextShadow = shadow;
				for (let index = 0; index < 12; index += 1) {
					next = rk4(next, dt);
					nextShadow = rk4(nextShadow, dt);
				}
				if (next.every(Number.isFinite) && next.every((value) => Math.abs(value) < 80)) {
					trajectory = next;
					const dx = nextShadow[0] - next[0];
					const dy = nextShadow[1] - next[1];
					const dz = nextShadow[2] - next[2];
					const separation = Math.max(Math.hypot(dx, dy, dz), 1e-12);
					const localExponent = Math.log(separation / 0.00001) / (dt * 12);
					lyapunov = lyapunov * 0.985 + Math.max(-2, Math.min(2, localExponent)) * 0.015;
					const scale = 0.00001 / separation;
					shadow = [next[0] + dx * scale, next[1] + dy * scale, next[2] + dz * scale];
					orbit = [...orbit.slice(-319), { x: next[0], y: next[1] }];
					scopeX = [...scopeX.slice(-95), Math.max(0.03, Math.min(0.97, 0.5 + next[0] / 7))];
					scopeY = [...scopeY.slice(-95), Math.max(0.03, Math.min(0.97, 0.5 + next[1] / 1.3))];
				} else {
					reset([0.11, 0, 0]);
				}
			}

			const root = host;
			if (root) {
				setNodeActive(root, 'X_NODE', Math.abs(trajectory[0]) > 0.35);
				setNodeActive(root, 'Y_NODE', Math.abs(trajectory[1]) > 0.08);
				setNodeActive(root, 'NR', !faults.bypassedNonlinearity);
				setNodeDegraded(root, 'NR', faults.bypassedNonlinearity);
				styleWiresFrom(
					root,
					'X_NODE.node',
					'--schematic-stroke-width',
					(1 + Math.min(Math.abs(trajectory[0]), 3)).toFixed(2)
				);
				styleWiresFrom(
					root,
					'Y_NODE.node',
					'--schematic-stroke-width',
					(1 + Math.min(Math.abs(trajectory[1]) * 3, 3)).toFixed(2)
				);
				styleWiresFrom(root, 'NR.sink', 'opacity', faults.bypassedNonlinearity ? '0.16' : '1');
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	function probe(element: Element): string | undefined {
		const wire = delegatedWireSource(element);
		if (wire === 'X_NODE.node' || wire === 'X_PROBE.node')
			return `x = v_C1 = ${trajectory[0].toFixed(4)} (normalized)`;
		if (wire === 'Y_NODE.node' || wire === 'Y_PROBE.node')
			return `y = v_C2 = ${trajectory[1].toFixed(4)} (normalized)`;
		if (wire === 'L1.out') return `z = i_L = ${trajectory[2].toFixed(4)} (normalized)`;
		const id = delegatedNodeId(element);
		if (id === 'NR')
			return faults.bypassedNonlinearity
				? 'g(v) BYPASSED — positive damping only'
				: `g(v): m₀=${m0.toFixed(3)}, m₁=${m1.toFixed(3)}`;
		if (id === 'R1') return `coupling gain α = ${alpha.toFixed(2)}`;
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="intro">
		<p>
			Move the normalized coupling and inductor ratios across a bifurcation boundary. The shadow
			trajectory begins only 10⁻⁵ away and estimates local divergence.
		</p>
	</div>
	<div class="controls">
		<label
			><span class="microlabel">α = {alpha.toFixed(2)}</span><input
				type="range"
				min="7"
				max="18"
				step="0.02"
				bind:value={alpha}
			/></label
		>
		<label
			><span class="microlabel">β = {beta.toFixed(2)}</span><input
				type="range"
				min="18"
				max="35"
				step="0.05"
				bind:value={beta}
			/></label
		>
		<label
			><span class="microlabel">m₀ = {m0.toFixed(3)}</span><input
				type="range"
				min="-1.5"
				max="-0.8"
				step="0.002"
				bind:value={m0}
			/></label
		>
		<label
			><span class="microlabel">time scale = {timeScale.toFixed(2)}×</span><input
				type="range"
				min="0.25"
				max="2"
				step="0.05"
				bind:value={timeScale}
			/></label
		>
	</div>
	<div class="button-row">
		<button type="button" class="btn" aria-pressed={paused} onclick={() => (paused = !paused)}
			>{paused ? 'resume' : 'pause'}</button
		>
		<button type="button" class="btn" onclick={() => reset()}>reset orbit</button>
		<button type="button" class="btn" onclick={perturb}>perturb 10⁻²</button>
		<button type="button" class="btn" onclick={computeBifurcation} disabled={computingBif}>
			{computingBif ? 'sweeping…' : 'sweep α → bifurcation'}
		</button>
	</div>
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch
			label="negative-resistance branch bypassed"
			bind:active={faults.bypassedNonlinearity}
		/>
	</div>
{/snippet}

{#snippet canvas()}
	<div
		class="sim-stage schemd-frame"
		bind:this={host}
		role="group"
		aria-label="Chua nonlinear oscillator circuit"
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<div
		class="regime"
		class:chaotic={regime === 'CHAOTIC'}
		class:faulted={faults.bypassedNonlinearity}
	>
		<span class="microlabel">orbit classifier</span><strong>{regime}</strong>
	</div>
	<div class="readouts">
		<span class="readout">x = {trajectory[0].toFixed(4)}</span>
		<span class="readout">y = {trajectory[1].toFixed(4)}</span>
		<span class="readout">z = {trajectory[2].toFixed(4)}</span>
		<span class="readout">λ_local ≈ {lyapunov.toFixed(4)}</span>
	</div>
	<PhasePortrait points={orbit} label="double-scroll phase portrait" xLabel="v_C1" yLabel="v_C2" />
	<figure class="bifurcation" aria-label="Bifurcation diagram: orbit maxima against α">
		<svg viewBox="0 0 240 150" role="img" aria-label="Bifurcation diagram">
			<rect class="bif-bezel" x="0.5" y="0.5" width="239" height="149" />
			{#if bifurcation.length > 0}
				<path class="bif-dots" d={bifurcationPath} />
				<line class="bif-marker" x1={alphaMarker} x2={alphaMarker} y1="0" y2="150" />
			{:else}
				<text class="bif-empty" x="120" y="78" text-anchor="middle">sweep α to draw the route to chaos</text>
			{/if}
		</svg>
		<figcaption class="microlabel">orbit maxima vs α ({BIF_MIN}–{BIF_MAX})</figcaption>
	</figure>
	<Oscilloscope
		channels={[
			{ samples: scopeX, name: 'v_C1' },
			{ samples: scopeY, name: 'v_C2' }
		]}
		label="state traces"
	/>
{/snippet}

<style>
	.controls,
	.switchboard,
	.readouts {
		display: grid;
		gap: var(--space-2);
	}
	.controls label {
		display: grid;
		gap: 2px;
	}
	.controls input[type='range'] {
		accent-color: var(--accent);
	}
	.intro p {
		margin: 0;
		color: var(--ink-mute);
		font-size: var(--text-sm);
	}
	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.button-row .btn[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--accent);
	}
	.regime {
		display: grid;
		gap: 2px;
		padding: var(--space-3);
		border: 1px solid var(--line-strong);
		background: var(--bg-inset);
	}
	.regime strong {
		color: var(--accent-2);
		font-family: var(--font-mono);
		font-size: var(--text-md);
	}
	.regime.chaotic {
		border-color: var(--accent);
		box-shadow: inset 3px 0 0 var(--accent);
	}
	.regime.faulted {
		border-color: var(--danger);
	}
	.regime.faulted strong {
		color: var(--danger);
	}
	.sim-stage :global(svg) {
		min-inline-size: 880px;
	}
	.bifurcation {
		margin: 0;
		display: grid;
		gap: 3px;
		justify-items: center;
	}
	.bifurcation svg {
		inline-size: 100%;
		max-inline-size: 240px;
		background: var(--bg-inset);
	}
	.bif-bezel {
		fill: none;
		stroke: var(--line-strong);
	}
	.bif-dots {
		fill: none;
		stroke: var(--accent);
		stroke-width: 0.9;
		stroke-linecap: round;
		opacity: 0.85;
	}
	.bif-marker {
		stroke: var(--accent-2);
		stroke-width: 0.8;
		stroke-dasharray: 3 2;
	}
	.bif-empty {
		fill: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: 8px;
	}
</style>
