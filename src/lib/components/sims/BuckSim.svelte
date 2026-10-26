<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();

	/**
	 * Closed-loop buck converter on the v2 bench.
	 *
	 * An averaged L–C state (RK4) runs continuously; the switching ripple is
	 * reconstructed on top of it for the scope. Every part carries its own value:
	 * input on the source, duty on the controller, switching frequency on the
	 * switch, L, C, and the load on theirs. Current pulses through the high-side
	 * switch, freewheels up through the diode, runs steadily through the
	 * inductor into the load, and sloshes in and out of the output capacitor.
	 */
	import { setNodeActive, setNodeDegraded, styleWiresFrom } from '#lib/sim-dom.ts';
	import { playTick } from '#lib/audio.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import FaultSwitch from './FaultSwitch.svelte';
	import LiveMath from './LiveMath.svelte';
	import SimulationMotionControl from './SimulationMotionControl.svelte';
	import { createSimulationMotion } from './simulation-motion.svelte';
	import { reading } from '#lib/simulation-math.ts';
	import { buckMetrics } from '#lib/simulation-models.ts';
	import { reportSimulationEvidence } from '#lib/simulation-evidence.ts';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import Bench from './bench/Bench.svelte';
	import PartControls from './bench/PartControls.svelte';
	import ProbeLayer from './bench/ProbeLayer.svelte';
	import ProbeSelects from './bench/ProbeSelects.svelte';
	import Scope from './bench/Scope.svelte';
	import { setFlow } from './bench/flow';
	import { probeChannels } from './bench/channels';
	import type { PartControl, ProbeNet } from './bench/types';

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
	let faults = $state({ gateLost: false });
	let probeA = $state<string | null>('sw');
	let probeB = $state<string | null>('il');
	const motion = createSimulationMotion('Buck-converter animation');
	const timeline = useSimulationTimelineModel();

	const inductance = $derived(inductanceMicro * 1e-6);
	const capacitance = $derived(capacitanceMicro * 1e-6);
	const frequency = $derived(frequencyKilo * 1e3);
	const effectiveDuty = $derived(faults.gateLost ? 0 : duty);
	const metrics = $derived(
		buckMetrics({
			vin,
			duty,
			load,
			inductance,
			capacitance,
			frequency,
			outputVoltage,
			inductorCurrent,
			gateLost: faults.gateLost
		})
	);
	const idealOutput = $derived(metrics.idealOutput);
	const loadCurrent = $derived(metrics.loadCurrent);
	const rippleCurrent = $derived(metrics.rippleCurrent);
	const rippleVoltage = $derived(metrics.rippleVoltage);
	const efficiency = $derived(metrics.efficiency);
	const conduction = $derived.by(() => {
		if (faults.gateLost || outputVoltage < 0.05) return 'OFF';
		if (inductorCurrent > rippleCurrent * 0.58) return 'CCM';
		if (inductorCurrent > rippleCurrent * 0.42) return 'BCM';
		return 'DCM';
	});
	const regime = $derived(
		{
			CCM: 'continuous conduction',
			BCM: 'boundary conduction',
			DCM: 'discontinuous conduction',
			OFF: 'power stage off'
		}[conduction]
	);
	const timelineProjection = $derived(
		[idealOutput, effectiveDuty, inductorCurrent, outputVoltage, efficiency][timeline.step] ?? 0
	);
	let loadExperimentArmed = $state(false);

	$effect(() => {
		if (!loadExperimentArmed || conduction === 'CCM') return;
		const root = host;
		if (!root) return;
		loadExperimentArmed = false;
		reportSimulationEvidence(root, 'buck', 'conduction-left-ccm');
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

	/* The averaged state keeps settling even while the animation is paused, so a
	   paused reader still sees where the operating point lands. */
	$effect(() => {
		let frame = 0;
		let stopped = false;
		let last = performance.now();
		const loop = (now: number): void => {
			if (stopped) return;
			const realDt = Math.min(0.035, (now - last) / 1000);
			last = now;
			const simulatedDt = realDt * 0.018;
			for (let index = 0; index < 48; index += 1) integrate(simulatedDt / 48);
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => {
			stopped = true;
			cancelAnimationFrame(frame);
		};
	});

	/* The compiled drawing reflects the stage: the switch, the rails, and the current. */
	$effect(() => {
		const root = host;
		if (!root) return;
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

		const iL = Math.min(1, inductorCurrent / 4);
		const iLoad = Math.min(1, loadCurrent / 4);
		const highSide = alive ? iL * Math.sqrt(effectiveDuty) : 0;
		const freewheel = alive ? iL * Math.sqrt(1 - effectiveDuty) : iL;
		const ripple = Math.min(1, rippleCurrent / Math.max(inductorCurrent, 0.4));
		setFlow(root, 'VIN.positive', highSide);
		setFlow(root, 'QH.drain', highSide);
		setFlow(root, 'SW.node', iL, { target: 'L1.in' });
		/* The diode conducts upward, from return to the switch node: against the drawn wire. */
		setFlow(root, 'SW.node', -freewheel, { target: 'D1.cathode' });
		setFlow(root, 'D1.anode', -freewheel);
		setFlow(root, 'L1.out', iL);
		setFlow(root, 'VOUT_NODE.node', iLoad, { target: 'RLOAD.in' });
		setFlow(root, 'VOUT_NODE.node', ripple * 0.6, {
			target: 'COUT.in',
			alternate: true,
			period: 0.5
		});
		setFlow(root, 'VOUT_NODE.node', 0, { target: 'VOUT_PROBE.node' });
		setFlow(root, 'VOUT_PROBE.node', 0);
		setFlow(root, 'RLOAD.out', iLoad);
		setFlow(root, 'COUT.out', ripple * 0.6, { alternate: true, period: 0.5 });
		setFlow(root, 'VIN.negative', -highSide);
	});

	function applyPreset(nextVin: number, nextDuty: number, nextLoad: number): void {
		vin = nextVin;
		duty = nextDuty;
		load = nextLoad;
		if (ui.audio) playTick(560);
	}

	const controls = $derived<PartControl[]>([
		{
			id: 'buck-vin',
			node: 'VIN',
			label: 'Vin',
			ariaLabel: 'Input voltage',
			min: 5,
			max: 36,
			step: 0.1,
			value: vin,
			display: `${vin.toFixed(1)} V`,
			set: (v) => (vin = v),
			place: 'below'
		},
		{
			id: 'buck-duty',
			node: 'CTRL',
			label: 'duty',
			ariaLabel: 'Duty cycle',
			min: 0.05,
			max: 0.95,
			step: 0.005,
			value: duty,
			display: `${(duty * 100).toFixed(1)} %`,
			set: (v) => (duty = v),
			place: 'below'
		},
		{
			id: 'buck-fsw',
			node: 'QH',
			label: 'fsw',
			ariaLabel: 'Switching frequency',
			min: 20,
			max: 500,
			step: 1,
			value: frequencyKilo,
			display: `${frequencyKilo.toFixed(0)} kHz`,
			set: (v) => (frequencyKilo = v),
			place: 'above'
		},
		{
			id: 'buck-l',
			node: 'L1',
			label: 'L',
			ariaLabel: 'Inductance',
			min: 10,
			max: 220,
			step: 1,
			value: inductanceMicro,
			display: `${inductanceMicro.toFixed(0)} µH`,
			set: (v) => (inductanceMicro = v),
			place: 'above'
		},
		{
			id: 'buck-c',
			node: 'COUT',
			label: 'C',
			ariaLabel: 'Output capacitance',
			min: 22,
			max: 470,
			step: 1,
			value: capacitanceMicro,
			display: `${capacitanceMicro.toFixed(0)} µF`,
			set: (v) => (capacitanceMicro = v),
			place: 'left'
		},
		{
			id: 'buck-load',
			node: 'RLOAD',
			label: 'load',
			ariaLabel: 'Load resistance',
			min: 1,
			max: 30,
			step: 0.1,
			value: load,
			display: `${load.toFixed(1)} Ω`,
			set: (v) => (load = v),
			change: () => (loadExperimentArmed = true),
			place: 'right'
		}
	]);

	/* Three switching periods across the scope screen. */
	const PERIODS = 3;
	const carrierAt = (x: number, phase: number) =>
		(((x * PERIODS - phase / (Math.PI * 2)) % 1) + 1) % 1;
	const triangleAt = (carrier: number) =>
		carrier < effectiveDuty
			? carrier / Math.max(effectiveDuty, 0.01)
			: 1 - (carrier - effectiveDuty) / Math.max(1 - effectiveDuty, 0.01);
	const nets = $derived<ProbeNet[]>([
		{
			id: 'vin',
			sources: ['VIN.positive'],
			label: 'Vin',
			unit: 'V',
			sample: () => vin,
			summary: () => `${vin.toFixed(1)} V DC`,
			reading: () =>
				reading('buck.probe.input', `input rail ${vin.toFixed(1)} volts DC`, {
					value: vin.toFixed(1)
				})
		},
		{
			id: 'sw',
			sources: ['QH.drain', 'SW.node'],
			label: 'switch node',
			unit: 'V',
			sample: (x, phase) => (carrierAt(x, phase) < effectiveDuty ? vin : -0.4),
			summary: () => `PWM ${Math.round(effectiveDuty * 100)} % at ${frequencyKilo.toFixed(0)} kHz`,
			reading: () =>
				reading(
					'buck.probe.pwm',
					`switch node PWM ${Math.round(duty * 100)} percent at ${frequencyKilo.toFixed(0)} kilohertz`,
					{
						duty: Math.round(duty * 100),
						frequency: frequencyKilo.toFixed(0)
					}
				)
		},
		{
			id: 'il',
			sources: ['L1.out'],
			label: 'i_L',
			unit: 'A',
			sample: (x, phase) =>
				Math.max(0, inductorCurrent + (triangleAt(carrierAt(x, phase)) - 0.5) * rippleCurrent),
			summary: () => `${inductorCurrent.toFixed(2)} A avg, ${rippleCurrent.toFixed(2)} A p-p`,
			reading: () =>
				reading(
					'buck.probe.inductor',
					`inductor current ${inductorCurrent.toFixed(3)} amperes, ${conduction}`,
					{
						current: inductorCurrent.toFixed(3),
						ripple: rippleCurrent.toFixed(3),
						mode: conduction
					}
				)
		},
		{
			id: 'vout',
			sources: ['VOUT_NODE.node', 'VOUT_PROBE.node'],
			label: 'Vout',
			unit: 'V',
			ac: true,
			/* The capacitor integrates the inductor ripple: a quarter-period lag, parabolic. */
			sample: (x, phase) =>
				outputVoltage +
				Math.sin(Math.PI * 2 * (carrierAt(x, phase) - effectiveDuty / 2)) * (rippleVoltage / 2),
			summary: () => `${outputVoltage.toFixed(3)} V, ${(rippleVoltage * 1e3).toFixed(1)} mV ripple`,
			reading: () =>
				reading('buck.probe.output', `output ${outputVoltage.toFixed(3)} volts`, {
					voltage: outputVoltage.toFixed(3),
					ripple: (rippleVoltage * 1e3).toFixed(1)
				})
		}
	]);
	const channels = $derived(probeChannels(nets, probeA, probeB));
	const revision = $derived(
		`${vin}:${duty}:${load}:${inductanceMicro}:${capacitanceMicro}:${frequencyKilo}:${faults.gateLost}:${probeA}:${probeB}:${outputVoltage.toFixed(2)}`
	);
</script>

<Bench
	title={t('Closed-loop buck converter')}
	tone="analog"
	status={t('{0}, {1} V out', [t(regime), outputVoltage.toFixed(2)])}
	{stage}
	{dock}
	{deck}
/>

{#snippet stage()}
	<div class="buck-canvas" class:motion-paused={motion.paused || motion.animationBlocked}>
		<div
			class="sim-stage buck-stage schemd-frame"
			bind:this={host}
			role="group"
			data-model-stage={timeline.step}
			data-model-value={timelineProjection}
			aria-label={t(
				'Buck converter. Drag the value tags on the source, controller, switch, inductor, capacitor, and load; click a wire to clip a probe on.'
			)}
		>
			{@html svg}
		</div>
		<PartControls {host} {controls} />
		<ProbeLayer {host} {nets} bind:a={probeA} bind:b={probeB} />
	</div>
{/snippet}

{#snippet dock()}
	<section class="dock-block" aria-label={t('Oscilloscope')}>
		<p class="microlabel">{t('Oscilloscope')}</p>
		<Scope
			{channels}
			running={!(motion.paused || motion.animationBlocked)}
			timebase={`${((PERIODS * 100) / frequencyKilo).toPrecision(2)} µs/div, three switching periods`}
			{revision}
		/>
	</section>
	<div class="mode-card" class:faulted={faults.gateLost} aria-live="polite" aria-atomic="true">
		<span class="microlabel">{t('Conduction regime')}</span>
		<strong>{t(conduction)}</strong>
		<span>
			{conduction === 'CCM'
				? t('inductor current stays above zero')
				: conduction === 'BCM'
					? t('at the conduction boundary')
					: conduction === 'DCM'
						? t('inductor fully demagnetizes')
						: t('power stage disabled')}
		</span>
		<span class="visually-hidden">
			{faults.gateLost
				? t('High-side switch degraded: gate drive lost.')
				: t('High-side switch active.')}
			{t(motion.status)}
		</span>
	</div>
	<section class="dock-block" aria-label={t('Readouts')}>
		<p class="microlabel">{t('Readouts')}</p>
		<div class="readouts">
			<span class="readout"
				><LiveMath
					id="buck.readout.vout"
					label={t('output {0} volts; ideal {1} volts', [
						outputVoltage.toFixed(3),
						idealOutput.toFixed(2)
					])}
					values={{ output: outputVoltage.toFixed(3), ideal: idealOutput.toFixed(2) }}
				/></span
			>
			<span class="readout"
				><LiveMath
					id="buck.readout.current"
					label={t('load current {0} amperes; inductor current {1} amperes', [
						loadCurrent.toFixed(3),
						inductorCurrent.toFixed(3)
					])}
					values={{ load: loadCurrent.toFixed(3), inductor: inductorCurrent.toFixed(3) }}
				/></span
			>
			<span class="readout"
				><LiveMath
					id="buck.readout.ripple.i"
					label={t('inductor ripple {0} amperes peak-to-peak', [rippleCurrent.toFixed(3)])}
					values={{ value: rippleCurrent.toFixed(3) }}
				/></span
			>
			<span class="readout"
				><LiveMath
					id="buck.readout.ripple.v"
					label={t('voltage ripple {0} millivolts peak-to-peak', [
						(rippleVoltage * 1e3).toFixed(1)
					])}
					values={{ value: (rippleVoltage * 1e3).toFixed(1) }}
				/></span
			>
			<span class="readout"
				><LiveMath
					id="buck.readout.efficiency"
					label={t('estimated efficiency {0} percent', [(efficiency * 100).toFixed(1)])}
					values={{ value: (efficiency * 100).toFixed(1) }}
				/></span
			>
		</div>
	</section>
{/snippet}

{#snippet deck()}
	<ProbeSelects {nets} bind:a={probeA} bind:b={probeB} />
	<div class="deck-group">
		<span class="microlabel">{t('Operating points')}</span>
		<div class="button-row">
			<button type="button" class="btn" data-timeline-input onclick={() => applyPreset(12, 0.42, 5)}
				><LiveMath
					id="buck.preset"
					label={t('12 volts to 5 volts')}
					values={{ input: 12, output: 5 }}
				/></button
			>
			<button type="button" class="btn" data-timeline-input onclick={() => applyPreset(24, 0.5, 8)}
				><LiveMath
					id="buck.preset"
					label={t('24 volts to 12 volts')}
					values={{ input: 24, output: 12 }}
				/></button
			>
			<button
				type="button"
				class="btn"
				data-timeline-input
				onclick={() => applyPreset(5, 0.24, 1.2)}
				><LiveMath
					id="buck.preset"
					label={t('5 volts to 1.2 volts')}
					values={{ input: 5, output: 1.2 }}
				/></button
			>
		</div>
	</div>
	<div class="deck-group">
		<SimulationMotionControl
			{motion}
			label={t('buck-converter waveform and switching animation')}
		/>
	</div>
	<div class="deck-group">
		<FaultSwitch label={t('High-side gate drive lost')} bind:active={faults.gateLost} />
	</div>
{/snippet}

<style>
	.buck-canvas {
		position: relative;
	}

	.buck-stage :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
		max-block-size: 64vh;
	}

	.dock-block,
	.readouts {
		display: grid;
		gap: var(--space-2);
	}

	.readout {
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}

	.mode-card {
		display: grid;
		gap: 2px;
		padding: var(--space-3);
		border: 1px solid var(--line);
		border-inline-start: 3px solid var(--accent);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		color: var(--ink-mute);

		& strong {
			font: 600 var(--text-lg) / 1.1 var(--font-sans);
			font-stretch: var(--width-table);
			font-variant-numeric: tabular-nums;
			color: var(--ink);
		}

		&.faulted {
			border-inline-start-color: var(--ink-faint);
		}
	}

	.deck-group {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}

	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
