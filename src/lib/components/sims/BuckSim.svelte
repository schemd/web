<script lang="ts">
	/** Closed-loop buck converter with an averaged L–C state solver and reconstructed ripple. */
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
	let vin = $state(18);
	let duty = $state(0.48);
	let load = $state(6);
	let inductanceMicro = $state(47);
	let capacitanceMicro = $state(220);
	let frequencyKilo = $state(120);
	let inductorCurrent = $state(1.25);
	let outputVoltage = $state(7.5);
	let scopeSwitch = $state<number[]>([]);
	let scopeCurrent = $state<number[]>([]);
	let scopeOutput = $state<number[]>([]);
	let faults = $state({ gateLost: false });

	const inductance = $derived(inductanceMicro * 1e-6);
	const capacitance = $derived(capacitanceMicro * 1e-6);
	const frequency = $derived(frequencyKilo * 1e3);
	const effectiveDuty = $derived(faults.gateLost ? 0 : duty);
	const idealOutput = $derived(vin * effectiveDuty);
	const loadCurrent = $derived(outputVoltage / load);
	const rippleCurrent = $derived(
		Math.max(0, ((vin - outputVoltage) * effectiveDuty) / (inductance * frequency))
	);
	const rippleVoltage = $derived(rippleCurrent / (8 * capacitance * frequency));
	const conduction = $derived.by(() => {
		if (faults.gateLost || outputVoltage < 0.05) return 'OFF';
		if (inductorCurrent > rippleCurrent * 0.58) return 'CCM';
		if (inductorCurrent > rippleCurrent * 0.42) return 'BCM';
		return 'DCM';
	});
	const efficiency = $derived.by(() => {
		if (faults.gateLost || outputVoltage < 0.05) return 0;
		const copperLoss = inductorCurrent * inductorCurrent * 0.085;
		const switchLoss = vin * Math.max(inductorCurrent, 0) * 32e-9 * frequency;
		const outputPower = (outputVoltage * outputVoltage) / load;
		return outputPower / Math.max(outputPower + copperLoss + switchLoss, 1e-9);
	});

	function derivatives(current: number, voltage: number): readonly [number, number] {
		const di = (effectiveDuty * vin - voltage) / inductance;
		const dv = (Math.max(0, current) - voltage / load) / capacitance;
		return [di, dv];
	}

	function integrate(dt: number): void {
		let i = inductorCurrent;
		let v = outputVoltage;
		const [k1i, k1v] = derivatives(i, v);
		const [k2i, k2v] = derivatives(i + (dt * k1i) / 2, v + (dt * k1v) / 2);
		const [k3i, k3v] = derivatives(i + (dt * k2i) / 2, v + (dt * k2v) / 2);
		const [k4i, k4v] = derivatives(i + dt * k3i, v + dt * k3v);
		i += (dt / 6) * (k1i + 2 * k2i + 2 * k3i + k4i);
		v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
		inductorCurrent = Math.max(0, Math.min(i, 80));
		outputVoltage = Math.max(0, Math.min(v, vin * 1.08));
	}

	$effect(() => {
		let frame = 0;
		let last = performance.now();
		const loop = (now: number): void => {
			const realDt = Math.min(0.035, (now - last) / 1000);
			last = now;
			const simulatedDt = realDt * 0.018;
			const steps = 48;
			for (let index = 0; index < steps; index += 1) integrate(simulatedDt / steps);

			const points = 96;
			const nextSwitch: number[] = [];
			const nextCurrent: number[] = [];
			const nextOutput: number[] = [];
			for (let index = 0; index < points; index += 1) {
				const carrier = ((index / points) * 4) % 1;
				const high = !faults.gateLost && carrier < duty;
				const triangle =
					carrier < duty
						? carrier / Math.max(duty, 0.01)
						: 1 - (carrier - duty) / Math.max(1 - duty, 0.01);
				nextSwitch.push(high ? 0.9 : 0.1);
				nextCurrent.push(
					Math.max(
						0.05,
						Math.min(
							0.95,
							0.5 + ((triangle - 0.5) * rippleCurrent) / Math.max(inductorCurrent * 2.4, 0.5)
						)
					)
				);
				nextOutput.push(Math.max(0.05, Math.min(0.95, 0.5 + (triangle - 0.5) * rippleVoltage * 3)));
			}
			scopeSwitch = nextSwitch;
			scopeCurrent = nextCurrent;
			scopeOutput = nextOutput;

			const root = host;
			if (root) {
				const alive = !faults.gateLost && effectiveDuty > 0;
				setNodeActive(root, 'QH', alive);
				setNodeActive(root, 'VOUT_NODE', outputVoltage > 0.2);
				setNodeActive(root, 'VOUT_PROBE', outputVoltage > 0.2);
				setNodeDegraded(root, 'QH', faults.gateLost);
				styleWiresFrom(root, 'QH.drain', 'opacity', alive ? '1' : '0.18');
				styleWiresFrom(
					root,
					'L1.out',
					'--schematic-stroke-width',
					(1 + Math.min(inductorCurrent / 3, 3)).toFixed(2)
				);
				styleWiresFrom(
					root,
					'VOUT_NODE.node',
					'opacity',
					String(0.25 + 0.75 * Math.min(outputVoltage / Math.max(idealOutput, 1), 1))
				);
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	function applyPreset(nextVin: number, nextDuty: number, nextLoad: number): void {
		vin = nextVin;
		duty = nextDuty;
		load = nextLoad;
		if (ui.audio) playTick(560);
	}

	function probe(element: Element): MathReading | undefined {
		const wire = delegatedWireSource(element);
		if (wire === 'VIN.positive')
			return reading('buck.probe.input', `input rail ${vin.toFixed(1)} volts DC`, {
				value: vin.toFixed(1)
			});
		if (wire === 'QH.drain' || wire === 'SW.node')
			return reading(
				'buck.probe.pwm',
				`switch node PWM ${Math.round(duty * 100)} percent at ${frequencyKilo.toFixed(0)} kilohertz`,
				{ duty: Math.round(duty * 100), frequency: frequencyKilo.toFixed(0) }
			);
		if (wire === 'L1.out')
			return reading(
				'buck.probe.inductor',
				`inductor current ${inductorCurrent.toFixed(3)} amperes, ${conduction}`,
				{ current: inductorCurrent.toFixed(3), ripple: rippleCurrent.toFixed(3), mode: conduction }
			);
		if (wire === 'VOUT_NODE.node' || wire === 'VOUT_PROBE.node')
			return reading('buck.probe.output', `output ${outputVoltage.toFixed(3)} volts`, {
				voltage: outputVoltage.toFixed(3),
				ripple: (rippleVoltage * 1e3).toFixed(1)
			});
		const id = delegatedNodeId(element);
		if (id === 'QH')
			return reading(
				'buck.probe.switch',
				faults.gateLost ? 'high-side gate drive lost' : `high-side switch duty ${duty.toFixed(3)}`,
				{ state: faults.gateLost ? 'gate drive LOST' : 'switching', duty: duty.toFixed(3) }
			);
		if (id === 'COUT')
			return reading(
				'buck.probe.cap',
				`output capacitance ${capacitanceMicro.toFixed(0)} microfarads`,
				{ value: capacitanceMicro.toFixed(0) }
			);
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="presets">
		<p class="microlabel">operating-point presets</p>
		<div class="button-row">
			<button type="button" class="btn" onclick={() => applyPreset(12, 0.42, 5)}
				><LiveMath
					id="buck.preset"
					label="12 volts to 5 volts"
					values={{ input: 12, output: 5 }}
				/></button
			>
			<button type="button" class="btn" onclick={() => applyPreset(24, 0.5, 8)}
				><LiveMath
					id="buck.preset"
					label="24 volts to 12 volts"
					values={{ input: 24, output: 12 }}
				/></button
			>
			<button type="button" class="btn" onclick={() => applyPreset(5, 0.24, 1.2)}
				><LiveMath
					id="buck.preset"
					label="5 volts to 1.2 volts"
					values={{ input: 5, output: 1.2 }}
				/></button
			>
		</div>
	</div>
	<div class="controls">
		<label
			><span class="microlabel"
				><LiveMath
					id="buck.control.vin"
					label={`input voltage ${vin.toFixed(1)} volts`}
					values={{ value: vin.toFixed(1) }}
				/></span
			><input type="range" min="5" max="36" step="0.1" bind:value={vin} /></label
		>
		<label
			><span class="microlabel"
				><LiveMath
					id="buck.control.duty"
					label={`duty ${(duty * 100).toFixed(1)} percent`}
					values={{ value: (duty * 100).toFixed(1) }}
				/></span
			><input type="range" min="0.05" max="0.95" step="0.005" bind:value={duty} /></label
		>
		<label
			><span class="microlabel"
				><LiveMath
					id="buck.control.load"
					label={`load resistance ${load.toFixed(1)} ohms`}
					values={{ value: load.toFixed(1) }}
				/></span
			><input type="range" min="1" max="30" step="0.1" bind:value={load} /></label
		>
		<label
			><span class="microlabel"
				><LiveMath
					id="buck.control.l"
					label={`inductance ${inductanceMicro.toFixed(0)} microhenries`}
					values={{ value: inductanceMicro.toFixed(0) }}
				/></span
			><input type="range" min="10" max="220" step="1" bind:value={inductanceMicro} /></label
		>
		<label
			><span class="microlabel"
				><LiveMath
					id="buck.control.c"
					label={`capacitance ${capacitanceMicro.toFixed(0)} microfarads`}
					values={{ value: capacitanceMicro.toFixed(0) }}
				/></span
			><input type="range" min="22" max="470" step="1" bind:value={capacitanceMicro} /></label
		>
		<label
			><span class="microlabel"
				><LiveMath
					id="buck.control.fsw"
					label={`switching frequency ${frequencyKilo.toFixed(0)} kilohertz`}
					values={{ value: frequencyKilo.toFixed(0) }}
				/></span
			><input type="range" min="20" max="500" step="1" bind:value={frequencyKilo} /></label
		>
	</div>
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="high-side gate drive lost" bind:active={faults.gateLost} />
	</div>
{/snippet}

{#snippet canvas()}
	<div
		class="sim-stage schemd-frame"
		bind:this={host}
		role="group"
		aria-label="Interactive closed-loop buck converter power stage"
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<div class="mode-card" class:faulted={faults.gateLost}>
		<span class="microlabel">conduction regime</span>
		<strong>{conduction}</strong>
		<span
			>{conduction === 'CCM'
				? 'inductor current stays above zero'
				: conduction === 'BCM'
					? 'at the conduction boundary'
					: conduction === 'DCM'
						? 'inductor fully demagnetizes'
						: 'power stage disabled'}</span
		>
	</div>
	<div class="readouts">
		<span class="readout"
			><LiveMath
				id="buck.readout.vout"
				label={`output ${outputVoltage.toFixed(3)} volts; ideal ${idealOutput.toFixed(2)} volts`}
				values={{ output: outputVoltage.toFixed(3), ideal: idealOutput.toFixed(2) }}
			/></span
		>
		<span class="readout"
			><LiveMath
				id="buck.readout.current"
				label={`load current ${loadCurrent.toFixed(3)} amperes; inductor current ${inductorCurrent.toFixed(3)} amperes`}
				values={{ load: loadCurrent.toFixed(3), inductor: inductorCurrent.toFixed(3) }}
			/></span
		>
		<span class="readout"
			><LiveMath
				id="buck.readout.ripple.i"
				label={`inductor ripple ${rippleCurrent.toFixed(3)} amperes peak-to-peak`}
				values={{ value: rippleCurrent.toFixed(3) }}
			/></span
		>
		<span class="readout"
			><LiveMath
				id="buck.readout.ripple.v"
				label={`voltage ripple ${(rippleVoltage * 1e3).toFixed(1)} millivolts peak-to-peak`}
				values={{ value: (rippleVoltage * 1e3).toFixed(1) }}
			/></span
		>
		<span class="readout"
			><LiveMath
				id="buck.readout.efficiency"
				label={`estimated efficiency ${(efficiency * 100).toFixed(1)} percent`}
				values={{ value: (efficiency * 100).toFixed(1) }}
			/></span
		>
	</div>
	<Oscilloscope
		channels={[
			{ samples: scopeSwitch, name: 'SW' },
			{ samples: scopeCurrent, math: reading('buck.scope.il', 'inductor current') },
			{ samples: scopeOutput, math: reading('buck.scope.vo', 'output voltage') }
		]}
		label="switching reconstruction"
	/>
{/snippet}

<style>
	.controls,
	.presets,
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
	.mode-card {
		display: grid;
		gap: 2px;
		padding: var(--space-3);
		border: 1px solid var(--ok);
		background: var(--bg-inset);
	}
	.mode-card strong {
		color: var(--ok);
		font-family: var(--font-mono);
		font-size: var(--text-lg);
	}
	.mode-card span:last-child {
		color: var(--ink-mute);
		font-size: var(--text-xs);
	}
	.mode-card.faulted {
		border-color: var(--danger);
	}
	.mode-card.faulted strong {
		color: var(--danger);
	}
	.sim-stage :global(svg) {
		min-inline-size: 880px;
	}
</style>
