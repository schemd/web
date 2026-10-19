<script lang="ts">
	/**
	 * Sigma-delta converter on the v2 bench.
	 *
	 * A coherent sine (exactly five cycles in 4096 samples) runs through the
	 * modulator. The scope shows one input period: the bitstream's density of
	 * ones tracking the sine, the integrator carrying the debt, and the
	 * decimated output. The spectrum is the bitstream's FFT on a log axis, with
	 * the signal band shaded, so noise shaping and the OSR trade are visible.
	 */
	import { setNodeDegraded } from '#lib/sim-dom.ts';
	import {
		decimate,
		inBandSnr,
		magnitudeSpectrum,
		sigmaDeltaTrace
	} from '#lib/simulation-models.ts';
	import { reading } from '#lib/simulation-math.ts';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import LiveMath from './LiveMath.svelte';
	import Bench from './bench/Bench.svelte';
	import PartControls from './bench/PartControls.svelte';
	import ProbeLayer from './bench/ProbeLayer.svelte';
	import ProbeSelects from './bench/ProbeSelects.svelte';
	import Scope from './bench/Scope.svelte';
	import Plot from './bench/Plot.svelte';
	import { probeChannels } from './bench/channels';
	import type { PartControl, ProbeNet } from './bench/types';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();
	let host = $state<HTMLElement | undefined>();
	let amplitude = $state(0.5);
	let logOsr = $state(5);
	let order = $state<1 | 2>(1);
	let leaky = $state(false);
	let probeA = $state<string | null>('input');
	let probeB = $state<string | null>('bits');
	const timeline = useSimulationTimelineModel();

	const N = 4096;
	const SIGNAL_BIN = 5;
	const PERIOD = Math.round(N / SIGNAL_BIN);
	const osr = $derived(Math.round(2 ** logOsr));
	const bandEdge = $derived(N / (2 * osr));
	const input = $derived(
		Array.from({ length: N }, (_, t) => amplitude * Math.sin((2 * Math.PI * SIGNAL_BIN * t) / N))
	);
	const trace = $derived(sigmaDeltaTrace(input, order, leaky ? 0.2 : 0));
	const spectrum = $derived(magnitudeSpectrum(trace.bits));
	const snr = $derived(inBandSnr(spectrum, SIGNAL_BIN, bandEdge));
	const enob = $derived(Math.max(0, (snr - 1.76) / 6.02));
	const output = $derived(decimate(trace.bits, osr));
	const density = $derived(trace.bits.slice(0, PERIOD).filter((bit) => bit > 0).length / PERIOD);
	const status = $derived(
		`${order === 1 ? 'first' : 'second'}-order · OSR ${osr} · ${enob.toFixed(1)} effective bits`
	);

	/* One input period on the scope, after the loop has settled. */
	const lastPeriod = (values: readonly number[]) => values.slice(N - PERIOD);
	const at = (values: readonly number[]) => (x: number) =>
		values[Math.min(values.length - 1, Math.floor(x * (values.length - 1)))] ?? 0;
	const loopFilter = $derived(order === 2 ? trace.second : trace.first);
	const errors = $derived(input.map((x, index) => x - (index === 0 ? 1 : trace.bits[index - 1]!)));

	const nets = $derived<ProbeNet[]>([
		{
			id: 'input',
			sources: ['VIN.positive'],
			label: 'x',
			unit: '',
			sample: at(lastPeriod(input)),
			summary: () => `${amplitude.toFixed(2)} pk`,
			reading: () =>
				reading('sd.probe.net', `input ${amplitude.toFixed(2)} peak`, {
					name: 'input',
					value: `${amplitude.toFixed(2)} peak`
				})
		},
		{
			id: 'error',
			sources: ['SUM.e', 'DAC.v'],
			label: 'x − y',
			unit: '',
			sample: at(lastPeriod(errors)),
			summary: () => 'debt per sample',
			reading: () =>
				reading('sd.probe.net', 'input minus the last bit', {
					name: 'error',
					value: 'input minus the last bit'
				})
		},
		{
			id: 'integrator',
			sources: ['INT.y'],
			label: '∫',
			unit: '',
			sample: at(lastPeriod(loopFilter)),
			summary: () => (leaky ? 'forgets its debt' : 'bounded'),
			reading: () =>
				reading('sd.probe.net', 'loop filter output', {
					name: 'loop filter',
					value: order === 2 ? 'second integrator' : 'integrator'
				})
		},
		{
			id: 'bits',
			sources: ['Q.out', 'FF.q'],
			label: 'bits',
			unit: '',
			sample: at(lastPeriod(trace.bits)),
			summary: () => `${(density * 100).toFixed(0)} % ones`,
			reading: () =>
				reading('sd.probe.net', `bitstream, ${(density * 100).toFixed(0)} percent ones`, {
					name: 'bitstream',
					value: `${(density * 100).toFixed(0)} % ones`
				})
		},
		{
			id: 'output',
			sources: ['DEC.y'],
			label: 'y',
			unit: '',
			sample: at(lastPeriod(output)),
			summary: () => `average of ${osr} bits`,
			reading: () =>
				reading('sd.probe.net', `decimated by ${osr}`, {
					name: 'decimated',
					value: `average of ${osr} bits`
				})
		}
	]);
	const channels = $derived(probeChannels(nets, probeA, probeB));

	/* The spectrum on a log axis: the loudest bin in each of 160 slices. */
	const SLICES = 160;
	const logBin = (fraction: number) => 10 ** (fraction * Math.log10(N / 2));
	const shaped = $derived(
		Array.from({ length: SLICES }, (_, index) => {
			const from = Math.max(1, Math.floor(logBin(index / SLICES)));
			const to = Math.max(from + 1, Math.floor(logBin((index + 1) / SLICES)));
			let peak = -160;
			for (let bin = from; bin < to && bin < spectrum.length; bin += 1)
				peak = Math.max(peak, spectrum[bin]!);
			return peak;
		})
	);
	const place = (bin: number) => Math.log10(bin) / Math.log10(N / 2);

	$effect(() => {
		const root = host;
		if (!root) return;
		setNodeDegraded(root, 'INT', leaky);
	});

	const controls = $derived<PartControl[]>([
		{
			id: 'sd-amplitude',
			node: 'VIN',
			label: 'x',
			ariaLabel: 'Input amplitude',
			min: 0.05,
			max: 0.7,
			step: 0.01,
			value: amplitude,
			display: `${amplitude.toFixed(2)} pk`,
			set: (value) => (amplitude = value),
			place: 'below'
		},
		{
			id: 'sd-osr',
			node: 'DEC',
			label: 'OSR',
			ariaLabel: 'Oversampling ratio, 8 to 128',
			min: 3,
			max: 7,
			step: 1,
			value: logOsr,
			display: String(osr),
			set: (value) => (logOsr = value),
			place: 'below'
		}
	]);

	const revision = $derived(`${amplitude}:${logOsr}:${order}:${leaky}:${probeA}:${probeB}`);
</script>

<Bench title="Sigma-delta converter" tone="analog" {status} {stage} {dock} {deck} />

{#snippet stage()}
	<div class="sd-canvas">
		<div
			class="sim-stage sd-stage schemd-frame"
			bind:this={host}
			role="group"
			aria-label="Sigma-delta modulator: summing node, integrator, clocked one-bit quantizer, feedback DAC, and decimator. Drag the tags on the input and the decimator; click a wire to probe it."
			data-model-stage={timeline.step}
		>
			{@html svg}
		</div>
		<PartControls {host} {controls} />
		<ProbeLayer {host} {nets} bind:a={probeA} bind:b={probeB} />
	</div>
{/snippet}

{#snippet dock()}
	<section class="dock-block" aria-label="Oscilloscope">
		<p class="microlabel">Oscilloscope</p>
		<Scope
			{channels}
			running={false}
			timebase={`one input period · ${PERIOD} samples`}
			{revision}
		/>
	</section>
	<Plot
		label={`Bitstream spectrum: in-band SNR ${snr.toFixed(1)} decibels over ${Math.floor(bandEdge)} bins`}
		series={[{ id: 'spectrum', values: shaped, tone: 'cyan' }]}
		min={-140}
		max={5}
		bands={[{ from: 0, to: place(bandEdge), label: 'signal band' }]}
		markers={[{ at: place(SIGNAL_BIN), tone: 'emerald', label: 'x' }]}
		xStart="f_s / N"
		xEnd="f_s / 2"
		height={140}
		caption="bitstream spectrum, dB · log frequency"
	/>
	<section class="dock-block" aria-label="Readouts">
		<p class="microlabel">Readouts</p>
		<div class="metrics">
			<div>
				<span>in-band SNR</span>
				<strong
					><LiveMath
						id="sd.readout.snr"
						label={`in-band signal to noise ${snr.toFixed(1)} decibels`}
						values={{ value: snr.toFixed(1) }}
					/></strong
				>
			</div>
			<div>
				<span>resolution</span>
				<strong
					><LiveMath
						id="sd.readout.enob"
						label={`${enob.toFixed(1)} effective bits`}
						values={{ value: enob.toFixed(1) }}
					/></strong
				>
			</div>
			<div>
				<span>signal band</span>
				<strong
					><LiveMath
						id="sd.readout.band"
						label={`signal band up to f s over ${2 * osr}`}
						values={{ value: String(2 * osr) }}
					/></strong
				>
			</div>
			<div>
				<span>density</span>
				<strong
					><LiveMath
						id="sd.readout.density"
						label={`${(density * 100).toFixed(0)} percent ones`}
						values={{ value: (density * 100).toFixed(0) }}
					/></strong
				>
			</div>
		</div>
	</section>
{/snippet}

{#snippet deck()}
	<ProbeSelects {nets} bind:a={probeA} bind:b={probeB} />
	<div class="deck-group">
		<span class="microlabel">Loop order</span>
		<div class="presets" role="group" aria-label="Modulator order">
			{#each [1, 2] as const as value (value)}
				<button
					class="btn"
					type="button"
					data-order={value}
					aria-pressed={order === value}
					onclick={() => (order = value)}>{value === 1 ? 'First order' : 'Second order'}</button
				>
			{/each}
		</div>
	</div>
	<div class="deck-group">
		<FaultSwitch label="integrator leaks charge" bind:active={leaky} />
	</div>
{/snippet}

<style>
	.sd-canvas {
		position: relative;
	}

	.sd-stage :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
		max-block-size: 62vh;
	}

	.dock-block {
		display: grid;
		gap: var(--space-2);
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);

		& > div {
			display: grid;
			gap: 2px;
			min-inline-size: 0;
		}

		& span {
			font: var(--text-xs) / 1.4 var(--font-mono);
			color: var(--ink-mute);
		}

		& strong {
			font-size: var(--text-sm);
			font-weight: 560;
			color: var(--ink);
			overflow-wrap: anywhere;
		}
	}

	.deck-group {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.btn[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
