<script lang="ts">
	import ControlStack from '../ControlStack.svelte';
	import SimulationLab from '../SimulationLab.svelte';
	import { astable555 } from '../astable-555';
	import { dispatchSimulationAudio } from '../audio';
	import { formatEngineering, type FaultMode, type ProbeMetric } from '../instrumentation';
	import type { SimulationLabProps } from '../types';

	let { version, definition, svg, compileMetrics }: SimulationLabProps = $props();

	let r1KiloOhms = $state(10);
	let r2KiloOhms = $state(47);
	let capacitanceMicroFarads = $state(10);
	let fault = $state<FaultMode>('none');

	const effectiveR1 = $derived(r1KiloOhms * 1_000);
	const effectiveR2 = $derived(r2KiloOhms * 1_000 * (fault === 'degraded-resistor' ? 1.75 : 1));
	const timing = $derived(astable555(effectiveR1, effectiveR2, capacitanceMicroFarads * 1e-6));
	const running = $derived(fault !== 'short-ground' && fault !== 'open-circuit');
	const observedFrequency = $derived(running ? timing.frequencyHz : 0);
	const traceRate = $derived(running ? Math.min(3.2, Math.max(0.18, timing.frequencyHz)) : 0.08);
	const metrics = $derived<readonly ProbeMetric[]>([
		{
			label: 'Output',
			value: running ? formatEngineering(observedFrequency, 'Hz') : 'STOPPED',
			tone: running ? (fault === 'none' ? 'good' : 'warning') : 'danger'
		},
		{ label: 'High time', value: formatEngineering(timing.highSeconds, 's') },
		{ label: 'Low time', value: formatEngineering(timing.lowSeconds, 's') },
		{
			label: 'Duty',
			value: `${(timing.dutyCycle * 100).toFixed(1)}%`,
			tone: timing.dutyCycle > 0.75 ? 'warning' : 'neutral'
		}
	]);

	function preset(
		event: MouseEvent,
		nextR1: number,
		nextR2: number,
		nextCapacitance: number
	): void {
		r1KiloOhms = nextR1;
		r2KiloOhms = nextR2;
		capacitanceMicroFarads = nextCapacitance;
		dispatchSimulationAudio(event.currentTarget, {
			frequency: Math.min(1_200, 300 + timing.frequencyHz * 120),
			duration: 0.07,
			wave: 'square',
			source: '555-astable:preset'
		});
	}
</script>

<SimulationLab
	{version}
	{definition}
	{svg}
	{compileMetrics}
	waveform="square"
	{traceRate}
	{metrics}
	bind:fault
>
	<ControlStack>
		<label class="control-field" for="r1">
			<span class="control-label">
				<span>Charge resistor R1</span>
				<strong class="control-value">{r1KiloOhms.toFixed(1)} kΩ</strong>
			</span>
			<input id="r1" type="range" min="1" max="100" step="1" bind:value={r1KiloOhms} />
			<span class="range-scale"><span>1 kΩ</span><span>100 kΩ</span></span>
		</label>

		<label class="control-field" for="r2">
			<span class="control-label">
				<span>Discharge resistor R2</span>
				<strong class="control-value">{r2KiloOhms.toFixed(1)} kΩ</strong>
			</span>
			<input id="r2" type="range" min="1" max="220" step="1" bind:value={r2KiloOhms} />
			<span class="range-scale"><span>1 kΩ</span><span>220 kΩ</span></span>
		</label>

		<label class="control-field" for="capacitance">
			<span class="control-label">
				<span>Timing capacitor C1</span>
				<strong class="control-value">{capacitanceMicroFarads.toFixed(1)} µF</strong>
			</span>
			<input
				id="capacitance"
				type="range"
				min="0.1"
				max="100"
				step="0.1"
				bind:value={capacitanceMicroFarads}
			/>
			<span class="range-scale"><span>0.1 µF</span><span>100 µF</span></span>
		</label>

		<div class="binary-readout">
			<span>Oscillator state</span>
			<strong>{running ? 'ASTABLE · RUN' : 'INHIBITED · LOW'}</strong>
		</div>

		<div class="button-row" aria-label="NE555 timing presets">
			<button type="button" onclick={(event) => preset(event, 10, 47, 10)}>Slow LED</button>
			<button class="primary" type="button" onclick={(event) => preset(event, 4.7, 10, 1)}>
				Fast pulse
			</button>
			<button type="button" onclick={(event) => preset(event, 1, 100, 0.1)}>High duty</button>
		</div>

		<p class="notice">
			The textbook astable topology cannot reach 50% duty without a steering diode. R1 is present
			during charge but absent during discharge.
		</p>
	</ControlStack>
</SimulationLab>
