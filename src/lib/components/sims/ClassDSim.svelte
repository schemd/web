<script lang="ts">
	/**
	 * Class-D amplifier on the v2 bench, and one you can hear.
	 *
	 * The comparator's PWM wave is generated sample by sample and passed through
	 * the LC filter's discrete twin, so the output probe shows the real residual
	 * ripple rather than a sketch of it. Listen renders the same signal into an
	 * audio buffer and plays it through a Web Audio low-pass at the filter's own
	 * cutoff; the carrier is slowed into earshot so the whine the filter removes
	 * is audible. Nothing plays until a Listen button is pressed.
	 */
	import { setNodeDegraded } from '#lib/sim-dom.ts';
	import {
		biquadLowPass,
		classDMetrics,
		classDPwm,
		lcCutoff,
		lcLowPass,
		triangleWave
	} from '#lib/simulation-models.ts';
	import { audioSampleRate, playSignal } from '#lib/audio.ts';
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
	import { setFlow } from './bench/flow';
	import { probeChannels } from './bench/channels';
	import { formatSi } from './bench/format';
	import type { PartControl, ProbeNet } from './bench/types';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();
	let host = $state<HTMLElement | undefined>();
	let logAudio = $state(Math.log10(440));
	let logCarrier = $state(Math.log10(12_000));
	let depth = $state(0.7);
	let logL = $state(-4);
	let logC = $state(Math.log10(22e-6));
	let filterOpen = $state(false);
	let playing = $state<'speaker' | 'raw' | null>(null);
	let stop: (() => void) | undefined;
	let probeA = $state<string | null>('pwm');
	let probeB = $state<string | null>('out');
	const timeline = useSimulationTimelineModel();

	const audio = $derived(10 ** logAudio);
	const carrier = $derived(10 ** logCarrier);
	const inductance = $derived(10 ** logL);
	const capacitance = $derived(10 ** logC);
	const cutoff = $derived(lcCutoff(inductance, capacitance));
	const metrics = $derived(
		classDMetrics({
			audioFrequency: audio,
			carrierFrequency: carrier,
			cutoff,
			depth,
			filterOpen
		})
	);
	const residualDb = $derived(20 * Math.log10(Math.max(1e-9, metrics.residual / (4 / Math.PI))));
	const status = $derived(
		metrics.cleanliness > 30
			? `clean audio · carrier ${(-residualDb).toFixed(0)} dB down`
			: metrics.cleanliness > 10
				? 'audible carrier whine'
				: 'carrier dominates the speaker'
	);

	/* Two audio cycles, sampled finely enough to resolve every carrier edge. */
	const trace = $derived.by(() => {
		const rate = Math.max(audio * 600, carrier * 40);
		const preroll = Math.round((3 * rate) / audio);
		const count = Math.round((2 * rate) / audio);
		const tone: number[] = [];
		const ramp: number[] = [];
		const pwm: number[] = [];
		for (let index = 0; index < preroll + count; index += 1) {
			const t = index / rate;
			const a = depth * Math.sin(2 * Math.PI * audio * t);
			const c = triangleWave(carrier * t);
			tone.push(a);
			ramp.push(c);
			pwm.push(classDPwm(a, c));
		}
		const out = filterOpen ? pwm : biquadLowPass(pwm, rate, cutoff);
		return {
			audio: tone.slice(preroll),
			carrier: ramp.slice(preroll),
			pwm: pwm.slice(preroll),
			out: out.slice(preroll)
		};
	});
	const at = (values: readonly number[]) => (x: number) =>
		values[Math.min(values.length - 1, Math.floor(x * (values.length - 1)))] ?? 0;

	const nets = $derived<ProbeNet[]>([
		{
			id: 'audio',
			sources: ['AUD.positive'],
			label: 'audio',
			unit: 'V',
			sample: at(trace.audio),
			summary: () => `${formatSi(audio, 'Hz', 0)} · ${depth.toFixed(2)} pk`,
			reading: () =>
				reading('classd.probe.net', `audio ${formatSi(audio, 'Hz', 0)}`, {
					name: 'audio',
					value: `${formatSi(audio, 'Hz', 0)}, ${depth.toFixed(2)} peak`
				})
		},
		{
			id: 'carrier',
			sources: ['TRI.positive'],
			label: 'carrier',
			unit: 'V',
			sample: at(trace.carrier),
			summary: () => formatSi(carrier, 'Hz', 1),
			reading: () =>
				reading('classd.probe.net', `carrier ${formatSi(carrier, 'Hz', 1)}`, {
					name: 'triangle carrier',
					value: formatSi(carrier, 'Hz', 1)
				})
		},
		{
			id: 'pwm',
			sources: ['CMP.out', 'BRIDGE.sw'],
			label: 'PWM',
			unit: 'V',
			sample: at(trace.pwm),
			summary: () => '±1 two-level',
			reading: () =>
				reading('classd.probe.net', 'pulse-width modulated, plus or minus one', {
					name: 'switch node',
					value: '±1, duty follows the audio'
				})
		},
		{
			id: 'out',
			sources: ['LF.out', 'VO.node'],
			label: 'speaker',
			unit: 'V',
			sample: at(trace.out),
			summary: () => `audio ×${metrics.audioGain.toFixed(2)} · carrier ${residualDb.toFixed(0)} dB`,
			reading: () =>
				reading('classd.probe.net', `speaker: carrier ${residualDb.toFixed(0)} decibels`, {
					name: 'speaker',
					value: `carrier residual ${residualDb.toFixed(0)} dB`
				})
		}
	]);
	const channels = $derived(probeChannels(nets, probeA, probeB));

	/* The filter at work: the capacitor shunts carrier current, the inductor carries audio. */
	$effect(() => {
		const root = host;
		if (!root) return;
		const shunted = filterOpen ? 0 : Math.max(0.15, 1 - lcLowPass(carrier, cutoff));
		setFlow(root, 'CF.out', shunted, { alternate: true, period: 0.4 });
		setFlow(root, 'LF.out', 0.7, { alternate: true, period: 1.4 });
		setFlow(root, 'SPK.out', 0.7, { alternate: true, period: 1.4 });
		setNodeDegraded(root, 'CF', filterOpen);
	});

	const response = $derived(
		Array.from({ length: 121 }, (_, index) => {
			const f = 10 ** (2 + (3 * index) / 120);
			return filterOpen ? 0 : 20 * Math.log10(lcLowPass(f, cutoff));
		})
	);
	const place = (f: number) => (Math.log10(f) - 2) / 3;

	function listen(which: 'speaker' | 'raw'): void {
		stop?.();
		if (playing === which) {
			playing = null;
			return;
		}
		const rate = audioSampleRate();
		const length = Math.round(rate * 1.6);
		const samples = new Float32Array(length);
		const fade = Math.round(rate * 0.02);
		const OVERSAMPLE = 8;
		for (let index = 0; index < length; index += 1) {
			let sum = 0;
			for (let k = 0; k < OVERSAMPLE; k += 1) {
				const t = (index + k / OVERSAMPLE) / rate;
				sum += classDPwm(depth * Math.sin(2 * Math.PI * audio * t), triangleWave(carrier * t));
			}
			const envelope = Math.min(1, index / fade, (length - index) / fade);
			samples[index] = (sum / OVERSAMPLE) * envelope * 0.5;
		}
		playing = which;
		stop = playSignal(
			samples,
			rate,
			which === 'speaker' && !filterOpen ? { cutoff, q: Math.SQRT1_2 } : undefined,
			() => (playing = playing === which ? null : playing)
		);
	}

	$effect(() => () => stop?.());

	const controls = $derived<PartControl[]>([
		{
			id: 'classd-audio',
			node: 'AUD',
			label: 'audio',
			ariaLabel: 'Audio frequency, 100 hertz to 2 kilohertz',
			min: 2,
			max: 3.3,
			step: 0.01,
			value: logAudio,
			display: formatSi(audio, 'Hz', 0),
			set: (value) => (logAudio = value),
			place: 'above'
		},
		{
			id: 'classd-carrier',
			node: 'TRI',
			label: 'carrier',
			ariaLabel: 'Carrier frequency, 4 to 20 kilohertz',
			min: 3.6,
			max: 4.3,
			step: 0.005,
			value: logCarrier,
			display: formatSi(carrier, 'Hz', 1),
			set: (value) => (logCarrier = value),
			place: 'below'
		},
		{
			id: 'classd-depth',
			node: 'CMP',
			label: 'depth',
			ariaLabel: 'Modulation depth',
			min: 0.1,
			max: 0.95,
			step: 0.01,
			value: depth,
			display: depth.toFixed(2),
			set: (value) => (depth = value),
			place: 'above'
		},
		{
			id: 'classd-inductance',
			node: 'LF',
			label: 'L',
			ariaLabel: 'Filter inductance',
			min: -5,
			max: -3,
			step: 0.01,
			value: logL,
			display: formatSi(inductance, 'H', 0),
			set: (value) => (logL = value),
			place: 'above'
		},
		{
			id: 'classd-capacitance',
			node: 'CF',
			label: 'C',
			ariaLabel: 'Filter capacitance',
			min: -6,
			max: -4,
			step: 0.01,
			value: logC,
			display: formatSi(capacitance, 'F', 1),
			set: (value) => (logC = value),
			place: 'left'
		}
	]);

	const revision = $derived(
		`${logAudio}:${logCarrier}:${depth}:${logL}:${logC}:${filterOpen}:${probeA}:${probeB}`
	);
</script>

<Bench title="Class-D amplifier" tone="analog" {status} {stage} {dock} {deck} />

{#snippet stage()}
	<div class="classd-canvas">
		<div
			class="sim-stage classd-stage schemd-frame"
			bind:this={host}
			role="group"
			aria-label="Class-D amplifier: audio and triangle carrier into a PWM comparator, a half-bridge, an L C filter, and a speaker. Drag the value tags; click a wire to probe it."
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
			timebase={`two audio cycles · ${formatSi(1 / (5 * audio), 's', 1)}/div`}
			{revision}
		/>
	</section>
	<section class="dock-block" aria-label="Readouts">
		<p class="microlabel">Readouts</p>
		<div class="metrics">
			<div>
				<span>cutoff</span>
				<strong
					><LiveMath
						id="classd.readout.fc"
						label={`filter cutoff ${formatSi(cutoff, 'Hz')}`}
						values={{ value: formatSi(cutoff, 'Hz') }}
					/></strong
				>
			</div>
			<div>
				<span>audio gain</span>
				<strong
					><LiveMath
						id="classd.readout.audio"
						label={`audio gain ${metrics.audioGain.toFixed(3)}`}
						values={{ value: metrics.audioGain.toFixed(3) }}
					/></strong
				>
			</div>
			<div>
				<span>carrier</span>
				<strong
					><LiveMath
						id="classd.readout.residual"
						label={`carrier residual ${residualDb.toFixed(1)} decibels`}
						values={{ value: residualDb.toFixed(1) }}
					/></strong
				>
			</div>
			<div>
				<span>cleanliness</span>
				<strong
					><LiveMath
						id="classd.readout.clean"
						label={`audio to carrier ratio ${metrics.cleanliness.toFixed(1)} decibels`}
						values={{ value: metrics.cleanliness.toFixed(1) }}
					/></strong
				>
			</div>
		</div>
	</section>
	<Plot
		label={`Filter response: audio at ${formatSi(audio, 'Hz', 0)}, carrier at ${formatSi(carrier, 'Hz', 1)}, cutoff ${formatSi(cutoff, 'Hz')}`}
		series={[{ id: 'response', values: response, tone: 'cyan' }]}
		min={-80}
		max={6}
		levels={[{ at: 0, label: '0 dB' }]}
		markers={[
			{ at: place(audio), tone: 'emerald', label: 'audio' },
			{ at: place(carrier), tone: 'amber', label: 'carrier' }
		]}
		xStart="100 Hz"
		xEnd="100 kHz"
		caption="|H(f)| in dB · 40 dB per decade above the cutoff"
	/>
{/snippet}

{#snippet deck()}
	<ProbeSelects {nets} bind:a={probeA} bind:b={probeB} />
	<div class="deck-group">
		<span class="microlabel">Listen · plays sound</span>
		<div class="presets">
			<button
				class="btn"
				type="button"
				data-listen="speaker"
				aria-pressed={playing === 'speaker'}
				onclick={() => listen('speaker')}
				>{playing === 'speaker' ? 'Stop' : 'Listen at the speaker'}</button
			>
			<button
				class="btn"
				type="button"
				data-listen="raw"
				aria-pressed={playing === 'raw'}
				onclick={() => listen('raw')}
				>{playing === 'raw' ? 'Stop' : 'Listen before the filter'}</button
			>
		</div>
		<p class="note">
			The carrier is slowed into earshot; real amplifiers switch at hundreds of kilohertz.
		</p>
	</div>
	<div class="deck-group">
		<FaultSwitch label="output filter capacitor open" bind:active={filterOpen} />
	</div>
{/snippet}

<style>
	.classd-canvas {
		position: relative;
	}

	.classd-stage :global(svg) {
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

	.note {
		margin: 0;
		max-inline-size: 34ch;
		font: var(--text-xs) / 1.5 var(--font-mono);
		color: var(--ink-mute);
	}
</style>
