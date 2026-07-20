<script lang="ts">
	/**
	 * Dynamic RC low-pass filter.
	 *
	 * Sliders sweep R, C, and the stimulus frequency (10 Hz – 100 kHz). The
	 * cutoff f_c = 1/(2πRC) and the first-order magnitude response are pure
	 * `$derived` metrics; the output trace's opacity and dash pattern track the
	 * real attenuation, and the two-channel oscilloscope overlays the input
	 * reference against the attenuated, phase-shifted output.
	 */
	import { styleWiresFrom, delegatedWireSource } from '$lib/sim-dom';
	import Oscilloscope from './Oscilloscope.svelte';
	import LabShell from './LabShell.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import ProbeHud from './ProbeHud.svelte';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	let host = $state<HTMLElement | undefined>();
	/** log10 sliders for perceptually linear sweeps. */
	let logR = $state(4); /* 10 kΩ */
	let logC = $state(-7); /* 100 nF */
	let logF = $state(2); /* 100 Hz */
	let phase = $state(0);
	let scopeIn = $state<number[]>([]);
	let scopeOut = $state<number[]>([]);
	let faults = $state({ openCapacitor: false });

	const resistance = $derived(10 ** logR);
	const capacitance = $derived(10 ** logC);
	const frequency = $derived(10 ** logF);

	/** f_c = 1 / (2πRC), with an open capacitor faulting the pole away. */
	const cutoff = $derived(
		faults.openCapacitor ? Number.POSITIVE_INFINITY : 1 / (2 * Math.PI * resistance * capacitance)
	);
	const ratio = $derived(frequency / cutoff);
	/** |H(jω)| for a first-order low-pass. */
	const magnitude = $derived(1 / Math.sqrt(1 + ratio * ratio));
	const phaseShift = $derived(-Math.atan(ratio));
	const attenuationDb = $derived(20 * Math.log10(magnitude));

	function formatSi(value: number, unit: string): string {
		if (!Number.isFinite(value)) return `∞ ${unit}`;
		const prefixes: ReadonlyArray<readonly [number, string]> = [
			[1e9, 'G'],
			[1e6, 'M'],
			[1e3, 'k'],
			[1, ''],
			[1e-3, 'm'],
			[1e-6, 'µ'],
			[1e-9, 'n']
		];
		for (const [scale, prefix] of prefixes) {
			if (Math.abs(value) >= scale) return `${(value / scale).toFixed(2)} ${prefix}${unit}`;
		}
		return `${value.toExponential(2)} ${unit}`;
	}

	/* Attenuation → vector treatment on the compiled output path + V_out probe. */
	$effect(() => {
		const root = host;
		if (!root) return;
		const opacity = String(0.25 + 0.75 * magnitude);
		const dash =
			magnitude > 0.7
				? 'none'
				: `${(magnitude * 12 + 2).toFixed(1)} ${((1 - magnitude) * 8 + 1).toFixed(1)}`;
		for (const source of ['R1.out', 'VOUT_PROBE.node']) {
			styleWiresFrom(root, source, 'opacity', opacity);
			styleWiresFrom(root, source, 'stroke-dasharray', dash);
		}
		const capacitorOpacity = faults.openCapacitor ? '0.2' : '1';
		styleWiresFrom(root, 'VOUT_NODE.node', 'opacity', capacitorOpacity);
		styleWiresFrom(root, 'C1.out', 'opacity', capacitorOpacity);
	});

	/* 60 FPS waveform: input sine reference vs. attenuated, phase-shifted output. */
	$effect(() => {
		let frame = 0;
		const loop = (): void => {
			phase += 0.045;
			const points = 96;
			const nextIn: number[] = [];
			const nextOut: number[] = [];
			for (let index = 0; index < points; index += 1) {
				const t = (index / points) * Math.PI * 4 + phase;
				nextIn.push(0.5 + 0.42 * Math.sin(t));
				nextOut.push(0.5 + 0.42 * magnitude * Math.sin(t + phaseShift));
			}
			scopeIn = nextIn;
			scopeOut = nextOut;
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	function probe(element: Element): string | undefined {
		const wire = delegatedWireSource(element);
		if (wire === 'VIN.positive' || wire === 'VIN.negative') {
			return `V_in = 1.000 V_pp @ ${formatSi(frequency, 'Hz')}`;
		}
		if (wire === 'R1.out' || wire === 'VOUT_PROBE.node') {
			return `V_out = ${magnitude.toFixed(3)} V_pp · ${attenuationDb.toFixed(1)} dB · φ ${(phaseShift * 57.2958).toFixed(1)}°`;
		}
		if (wire === 'VOUT_NODE.node' || wire === 'C1.out') {
			return faults.openCapacitor
				? 'C branch OPEN (fault)'
				: `I_C path · f_c = ${formatSi(cutoff, 'Hz')}`;
		}
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="controls">
		<label>
			<span class="microlabel">R = {formatSi(resistance, 'Ω')}</span>
			<input type="range" min="2" max="6" step="0.01" bind:value={logR} aria-label="Resistance" />
		</label>
		<label>
			<span class="microlabel">C = {formatSi(capacitance, 'F')}</span>
			<input
				type="range"
				min="-9"
				max="-5"
				step="0.01"
				bind:value={logC}
				aria-label="Capacitance"
			/>
		</label>
		<label>
			<span class="microlabel">f = {formatSi(frequency, 'Hz')}</span>
			<input
				type="range"
				min="1"
				max="5"
				step="0.01"
				bind:value={logF}
				aria-label="Stimulus frequency, 10 hertz to 100 kilohertz"
			/>
		</label>
	</div>
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="capacitor branch open" bind:active={faults.openCapacitor} />
	</div>
{/snippet}

{#snippet canvas()}
	<div class="sim-stage schemd-frame" bind:this={host}>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<div class="readouts">
		<span class="readout">f_c = {formatSi(cutoff, 'Hz')}</span>
		<span class="readout">|H| = {magnitude.toFixed(3)} ({attenuationDb.toFixed(1)} dB)</span>
		<span class="readout">φ = {(phaseShift * 57.2958).toFixed(1)}°</span>
	</div>
	<Oscilloscope
		channels={[
			{ samples: scopeIn, name: 'V_in' },
			{ samples: scopeOut, name: 'V_out' }
		]}
		label="V_in vs V_out"
	/>
{/snippet}

<style>
	.controls,
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

	.readouts {
		display: grid;
		gap: var(--space-1);
	}
</style>
