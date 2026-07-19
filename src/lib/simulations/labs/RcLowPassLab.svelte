<script lang="ts">
	import ControlStack from '../ControlStack.svelte';
	import SimulationLab from '../SimulationLab.svelte';
	import { dispatchSimulationAudio } from '../audio';
	import { formatEngineering, type FaultMode, type ProbeMetric } from '../instrumentation';
	import { logarithmicFrequency, rcLowPass } from '../rc-low-pass';
	import type { SimulationLabProps } from '../types';

	let { version, definition, svg, compileMetrics }: SimulationLabProps = $props();

	let frequencyPosition = $state(0.46);
	let inputVoltage = $state(5);
	let resistanceKiloOhms = $state(10);
	let capacitanceNanoFarads = $state(100);
	let fault = $state<FaultMode>('none');

	const frequency = $derived(logarithmicFrequency(frequencyPosition));
	const nominalResistance = $derived(resistanceKiloOhms * 1_000);
	const effectiveResistance = $derived(
		fault === 'degraded-resistor' ? nominalResistance * 1.8 : nominalResistance
	);
	const capacitance = $derived(capacitanceNanoFarads * 1e-9);
	const response = $derived(rcLowPass(frequency, effectiveResistance, capacitance, inputVoltage));
	const measuredOutput = $derived(
		fault === 'short-ground' ? 0 : fault === 'open-circuit' ? Number.NaN : response.outputVolts
	);
	const traceRate = $derived(Math.min(3.5, Math.max(0.18, frequency / response.cutoffHz)));
	const metrics = $derived<readonly ProbeMetric[]>([
		{
			label: 'Vout RMS',
			value: Number.isFinite(measuredOutput) ? `${measuredOutput.toFixed(3)} V` : 'FLOAT',
			tone: fault === 'none' ? 'good' : 'danger'
		},
		{ label: 'Cutoff', value: formatEngineering(response.cutoffHz, 'Hz') },
		{ label: 'Gain', value: `${response.gainDb.toFixed(2)} dB` },
		{
			label: 'Phase',
			value: `${response.phaseDegrees.toFixed(1)}°`,
			tone: Math.abs(response.phaseDegrees) > 60 ? 'warning' : 'neutral'
		}
	]);

	function chooseFrequency(event: MouseEvent, value: number): void {
		frequencyPosition = value;
		dispatchSimulationAudio(event.currentTarget, {
			frequency: 240 + value * 700,
			duration: 0.07,
			source: 'rc-low-pass:preset'
		});
	}
</script>

<SimulationLab
	{version}
	{definition}
	{svg}
	{compileMetrics}
	waveform="sine"
	{traceRate}
	{metrics}
	bind:fault
>
	<ControlStack>
		<label class="control-field" for="frequency">
			<span class="control-label">
				<span>Source frequency</span>
				<strong class="control-value">{formatEngineering(frequency, 'Hz')}</strong>
			</span>
			<input
				id="frequency"
				type="range"
				min="0"
				max="1"
				step="0.001"
				bind:value={frequencyPosition}
			/>
			<span class="range-scale"><span>10 Hz</span><span>100 kHz · log</span></span>
		</label>

		<label class="control-field" for="input-voltage">
			<span class="control-label">
				<span>Input amplitude</span>
				<strong class="control-value">{inputVoltage.toFixed(1)} V</strong>
			</span>
			<input
				id="input-voltage"
				type="range"
				min="0"
				max="12"
				step="0.1"
				bind:value={inputVoltage}
			/>
			<span class="range-scale"><span>0 V</span><span>12 V</span></span>
		</label>

		<label class="control-field" for="rc-resistance">
			<span class="control-label">
				<span>Resistance</span>
				<strong class="control-value">{resistanceKiloOhms.toFixed(1)} kΩ</strong>
			</span>
			<input
				id="rc-resistance"
				type="range"
				min="1"
				max="100"
				step="0.5"
				bind:value={resistanceKiloOhms}
			/>
		</label>

		<label class="control-field" for="rc-capacitance">
			<span class="control-label">
				<span>Capacitance</span>
				<strong class="control-value">{capacitanceNanoFarads.toFixed(0)} nF</strong>
			</span>
			<input
				id="rc-capacitance"
				type="range"
				min="10"
				max="1000"
				step="10"
				bind:value={capacitanceNanoFarads}
			/>
		</label>

		<div class="button-row" aria-label="Frequency sweep presets">
			<button type="button" onclick={(event) => chooseFrequency(event, 0.18)}>Passband</button>
			<button class="primary" type="button" onclick={(event) => chooseFrequency(event, 0.55)}>
				Knee
			</button>
			<button type="button" onclick={(event) => chooseFrequency(event, 0.86)}>Stopband</button>
		</div>

		<p class="notice">
			The frequency slider is logarithmic. Each equal movement covers the same ratio, not the same
			number of hertz.
		</p>
	</ControlStack>
</SimulationLab>
