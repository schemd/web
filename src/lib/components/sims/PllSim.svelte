<script lang="ts">
	/** Integer-N charge-pump PLL with a visual-time second-order phase-domain solver. */
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
	import ProbeHud from './ProbeHud.svelte';
	import LiveMath from './LiveMath.svelte';
	import { reading, type MathReading } from '$lib/simulation-math';

	interface Props {
		svg: string;
	}
	let { svg }: Props = $props();

	let host = $state<HTMLElement | undefined>();
	let referenceKilo = $state(10);
	let divider = $state(16);
	let bandwidthKilo = $state(1.2);
	let damping = $state(0.72);
	let vcoFrequency = $state(124_000);
	let frequencyVelocity = $state(0);
	let phaseError = $state(1.4);
	let controlVoltage = $state(1.7);
	let confidence = $state(0);
	let cycleSlips = $state(0);
	let scopePhase = $state<number[]>([]);
	let scopeControl = $state<number[]>([]);
	let scopeFrequency = $state<number[]>([]);
	let faults = $state({ referenceLost: false });

	const referenceFrequency = $derived(referenceKilo * 1e3);
	const targetFrequency = $derived(referenceFrequency * divider);
	const dividedFrequency = $derived(vcoFrequency / divider);
	const frequencyError = $derived(vcoFrequency - targetFrequency);
	const ppmError = $derived((frequencyError / Math.max(targetFrequency, 1)) * 1e6);
	const locked = $derived(!faults.referenceLost && Math.abs(ppmError) < 50 && confidence > 0.82);
	const lockState = $derived(
		faults.referenceLost
			? 'HOLDOVER'
			: locked
				? 'PHASE LOCK'
				: confidence > 0.35
					? 'PULL-IN'
					: 'ACQUIRING'
	);

	function wrapPhase(value: number): number {
		return Math.atan2(Math.sin(value), Math.cos(value));
	}

	function reacquire(): void {
		vcoFrequency = targetFrequency * 0.76;
		frequencyVelocity = 0;
		phaseError = 1.8;
		confidence = 0;
		cycleSlips = 0;
		if (ui.audio) playTick(540);
	}

	$effect(() => {
		let frame = 0;
		let last = performance.now();
		const loop = (now: number): void => {
			const dt = Math.min(0.04, (now - last) / 1000);
			last = now;
			const naturalFrequency = 2 * Math.PI * bandwidthKilo;
			const commanded = faults.referenceLost ? targetFrequency * 0.91 : targetFrequency;
			const acceleration =
				naturalFrequency * naturalFrequency * (commanded - vcoFrequency) -
				2 * damping * naturalFrequency * frequencyVelocity;
			frequencyVelocity += acceleration * dt;
			vcoFrequency = Math.max(1, vcoFrequency + frequencyVelocity * dt);

			const rawPhase =
				phaseError +
				2 *
					Math.PI *
					((referenceFrequency - vcoFrequency / divider) / Math.max(referenceFrequency, 1)) *
					dt *
					4;
			if (Math.abs(rawPhase) > Math.PI && Math.sign(rawPhase) === Math.sign(phaseError))
				cycleSlips += 1;
			phaseError = wrapPhase(rawPhase);
			controlVoltage = Math.max(
				0.1,
				Math.min(4.9, 2.5 + ((vcoFrequency - targetFrequency) / Math.max(targetFrequency, 1)) * 4)
			);
			const instantConfidence = faults.referenceLost
				? 0
				: Math.exp(-Math.abs(ppmError) / 900) * Math.exp(-Math.abs(phaseError) / 0.65);
			confidence += (instantConfidence - confidence) * Math.min(1, dt * 4);

			scopePhase = [...scopePhase.slice(-95), 0.5 + phaseError / (2 * Math.PI)];
			scopeControl = [...scopeControl.slice(-95), controlVoltage / 5];
			scopeFrequency = [
				...scopeFrequency.slice(-95),
				Math.max(0.04, Math.min(0.96, 0.5 + ppmError / 200_000))
			];

			const root = host;
			if (root) {
				setNodeActive(root, 'PFD', !locked && !faults.referenceLost);
				setNodeActive(root, 'CP', !locked && !faults.referenceLost);
				setNodeActive(root, 'VCO', vcoFrequency > 0);
				setNodeActive(root, 'DIV', !faults.referenceLost);
				setNodeDegraded(root, 'REF', faults.referenceLost);
				setNodeDegraded(root, 'PFD', faults.referenceLost);
				styleWiresFrom(root, 'REF.out', 'opacity', faults.referenceLost ? '0.14' : '1');
				styleWiresFrom(root, 'DIV.fb', 'stroke-dasharray', locked ? 'none' : '5 4');
				styleWiresFrom(
					root,
					'VCTRL.node',
					'--schematic-stroke-width',
					(1 + controlVoltage * 0.55).toFixed(2)
				);
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	function applyProfile(reference: number, ratio: number, bandwidth: number, zeta: number): void {
		referenceKilo = reference;
		divider = ratio;
		bandwidthKilo = bandwidth;
		damping = zeta;
		queueMicrotask(reacquire);
	}

	function probe(element: Element): MathReading | undefined {
		const wire = delegatedWireSource(element);
		if (wire === 'REF.out')
			return reading(
				'pll.probe.reference',
				faults.referenceLost
					? 'reference clock lost'
					: `reference ${referenceKilo.toFixed(2)} kilohertz`,
				{ value: faults.referenceLost ? 'reference lost' : `${referenceKilo.toFixed(2)} kHz` }
			);
		if (wire === 'PFD.up' || wire === 'PFD.down')
			return reading(
				'pll.readout.phase',
				`phase error ${((phaseError * 180) / Math.PI).toFixed(2)} degrees`,
				{ value: ((phaseError * 180) / Math.PI).toFixed(2) }
			);
		if (wire === 'VCTRL.node' || wire === 'RLP.out')
			return reading('pll.readout.control', `control voltage ${controlVoltage.toFixed(3)} volts`, {
				value: controlVoltage.toFixed(3)
			});
		if (wire === 'VCO.clk')
			return reading(
				'pll.probe.output',
				`output ${(vcoFrequency / 1e3).toFixed(3)} kilohertz, error ${ppmError.toFixed(0)} parts per million`,
				{ frequency: (vcoFrequency / 1e3).toFixed(3), ppm: ppmError.toFixed(0) }
			);
		if (wire === 'DIV.fb')
			return reading(
				'pll.probe.feedback',
				`feedback ${(dividedFrequency / 1e3).toFixed(3)} kilohertz divided by ${divider}`,
				{ value: (dividedFrequency / 1e3).toFixed(3), divider }
			);
		const id = delegatedNodeId(element);
		if (id === 'PFD')
			return reading(
				'pll.readout.phase',
				`phase detector error ${((phaseError * 180) / Math.PI).toFixed(2)} degrees`,
				{ value: ((phaseError * 180) / Math.PI).toFixed(2) }
			);
		if (id === 'VCO')
			return reading(
				'pll.probe.vco',
				`VCO ${(vcoFrequency / 1e3).toFixed(3)} kilohertz at ${controlVoltage.toFixed(2)} volts`,
				{ frequency: (vcoFrequency / 1e3).toFixed(3), voltage: controlVoltage.toFixed(2) }
			);
		if (id === 'DIV')
			return reading('pll.probe.divider', `programmable divider ${divider}`, { value: divider });
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="profiles">
		<p class="microlabel">loop profiles</p>
		<div class="button-row">
			<button type="button" class="btn" onclick={() => applyProfile(10, 16, 1.2, 0.72)}
				>balanced</button
			>
			<button type="button" class="btn" onclick={() => applyProfile(12, 32, 4.2, 0.48)}
				>fast / underdamped</button
			>
			<button type="button" class="btn" onclick={() => applyProfile(8, 24, 0.45, 1.25)}
				>quiet / overdamped</button
			>
		</div>
	</div>
	<div class="controls">
		<label
			><span class="microlabel"
				><LiveMath
					id="pll.control.ref"
					label={`reference frequency ${referenceKilo.toFixed(2)} kilohertz`}
					values={{ value: referenceKilo.toFixed(2) }}
				/></span
			><input type="range" min="1" max="20" step="0.05" bind:value={referenceKilo} /></label
		>
		<label
			><span class="microlabel"
				><LiveMath
					id="pll.control.n"
					label={`feedback divider ${divider}`}
					values={{ value: divider }}
				/></span
			><input type="range" min="2" max="64" step="1" bind:value={divider} /></label
		>
		<label
			><span class="microlabel"
				><LiveMath
					id="pll.control.bw"
					label={`loop bandwidth ${bandwidthKilo.toFixed(2)} kilohertz`}
					values={{ value: bandwidthKilo.toFixed(2) }}
				/></span
			><input type="range" min="0.2" max="8" step="0.05" bind:value={bandwidthKilo} /></label
		>
		<label
			><span class="microlabel"
				><LiveMath
					id="pll.control.zeta"
					label={`damping ratio ${damping.toFixed(2)}`}
					values={{ value: damping.toFixed(2) }}
				/></span
			><input type="range" min="0.25" max="1.6" step="0.01" bind:value={damping} /></label
		>
	</div>
	<button type="button" class="btn btn-solid" onclick={reacquire}>force reacquisition</button>
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="reference clock disconnected" bind:active={faults.referenceLost} />
	</div>
{/snippet}

{#snippet canvas()}
	<div
		class="sim-stage schemd-frame"
		bind:this={host}
		role="group"
		aria-label="Charge-pump phase-locked loop circuit"
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<div class="lock-card" class:locked class:holdover={faults.referenceLost}>
		<div class="lock-ring" style={`--confidence: ${(confidence * 360).toFixed(1)}deg`}>
			<span>{Math.round(confidence * 100)}%</span>
		</div>
		<div><span class="microlabel">loop state</span><strong>{lockState}</strong></div>
	</div>
	<div class="readouts">
		<span class="readout"
			><LiveMath
				id="pll.readout.target"
				label={`target frequency ${(targetFrequency / 1e3).toFixed(3)} kilohertz`}
				values={{ value: (targetFrequency / 1e3).toFixed(3) }}
			/></span
		>
		<span class="readout"
			><LiveMath
				id="pll.readout.vco"
				label={`VCO frequency ${(vcoFrequency / 1e3).toFixed(3)} kilohertz`}
				values={{ value: (vcoFrequency / 1e3).toFixed(3) }}
			/></span
		>
		<span class="readout"
			><LiveMath
				id="pll.readout.error"
				label={`frequency error ${ppmError.toFixed(1)} parts per million`}
				values={{ value: ppmError.toFixed(1) }}
			/></span
		>
		<span class="readout"
			><LiveMath
				id="pll.readout.phase"
				label={`phase error ${((phaseError * 180) / Math.PI).toFixed(2)} degrees`}
				values={{ value: ((phaseError * 180) / Math.PI).toFixed(2) }}
			/></span
		>
		<span class="readout"
			><LiveMath
				id="pll.readout.control"
				label={`control voltage ${controlVoltage.toFixed(3)} volts`}
				values={{ value: controlVoltage.toFixed(3) }}
			/></span
		>
		<span class="readout"
			><LiveMath
				id="pll.readout.slips"
				label={`${cycleSlips} cycle slips`}
				values={{ value: cycleSlips }}
			/></span
		>
	</div>
	<Oscilloscope
		channels={[
			{ samples: scopePhase, name: 'phase' },
			{ samples: scopeControl, math: reading('pll.scope.vctrl', 'control voltage') },
			{ samples: scopeFrequency, math: reading('pll.scope.df', 'frequency difference') }
		]}
		label="loop acquisition"
	/>
{/snippet}

<style>
	.controls,
	.profiles,
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
	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.lock-card {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--line-strong);
		background: var(--bg-inset);
	}
	.lock-card strong {
		display: block;
		color: var(--warn);
		font-family: var(--font-mono);
	}
	.lock-card.locked {
		border-color: var(--ok);
	}
	.lock-card.locked strong {
		color: var(--ok);
	}
	.lock-card.holdover {
		border-color: var(--danger);
	}
	.lock-card.holdover strong {
		color: var(--danger);
	}
	.lock-ring {
		display: grid;
		place-items: center;
		inline-size: 54px;
		aspect-ratio: 1;
		border-radius: 50%;
		background: conic-gradient(var(--accent) var(--confidence), var(--line) 0);
		position: relative;
	}
	.lock-ring::after {
		content: '';
		position: absolute;
		inset: 5px;
		border-radius: 50%;
		background: var(--bg-inset);
	}
	.lock-ring span {
		position: relative;
		z-index: 1;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-mute);
	}
	.sim-stage :global(svg) {
		min-inline-size: 1080px;
	}
</style>
