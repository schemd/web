<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();

	/**
	 * Phase-locked loop on the v2 bench.
	 *
	 * The state is the phase error θₑ and the filter's control voltage v_c,
	 * integrated live with RK4 in model milliseconds (frequencies in kHz). The
	 * scope compares the reference with the VCO and rolls the control voltage and
	 * detector output; the phase portrait plots v_c against K_d·sin θₑ, which
	 * collapses to a point in lock and opens into an orbit when cycles slip.
	 * Paused, or for a reader who prefers reduced motion, a change settles the
	 * loop at once so every readout stays truthful.
	 */
	import { untrack } from 'svelte';
	import { setNodeDegraded, styleWiresFrom } from '#lib/sim-dom.ts';
	import {
		pllCanLock,
		pllDerivatives,
		pllLockRange,
		type PllParams
	} from '#lib/simulation-models.ts';
	import { reading } from '#lib/simulation-math.ts';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import { createSimulationMotion } from './simulation-motion.svelte';
	import SimulationMotionControl from './SimulationMotionControl.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import LiveMath from './LiveMath.svelte';
	import PhasePortrait from './PhasePortrait.svelte';
	import Bench from './bench/Bench.svelte';
	import PartControls from './bench/PartControls.svelte';
	import ProbeLayer from './bench/ProbeLayer.svelte';
	import ProbeSelects from './bench/ProbeSelects.svelte';
	import Scope from './bench/Scope.svelte';
	import { probeChannels } from './bench/channels';
	import { formatSi, signed } from './bench/format';
	import type { PartControl, ProbeNet } from './bench/types';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();
	let host = $state<HTMLElement | undefined>();
	/* Frequencies in kHz; model time in ms, so ω is in rad/ms. */
	let reference = $state(10.4);
	let freeRunning = $state(10);
	let logR = $state(4);
	let shorted = $state(false);
	let phaseError = $state(0);
	let control = $state(0);
	let rate = $state(0);
	const HISTORY = 240;
	let controlHistory = $state<number[]>(Array.from({ length: HISTORY }, () => 0));
	let detectorHistory = $state<number[]>(Array.from({ length: HISTORY }, () => 0));
	let orbit = $state<{ x: number; y: number }[]>([]);
	let probeA = $state<string | null>('ref');
	let probeB = $state<string | null>('out');
	const timeline = useSimulationTimelineModel();
	const motion = createSimulationMotion('Phase-locked loop animation');

	const VCO_GAIN = 2 * Math.PI * 1.2;
	const DETECTOR_GAIN = 1;
	const CAPACITANCE = 50e-9;
	const DT = 0.004;
	const resistance = $derived(10 ** logR);
	/* τ = RC, in ms. */
	const tau = $derived(resistance * CAPACITANCE * 1e3);
	const params = $derived<PllParams>({
		reference: 2 * Math.PI * reference,
		freeRunning: 2 * Math.PI * freeRunning,
		vcoGain: VCO_GAIN,
		detectorGain: DETECTOR_GAIN,
		filterTau: tau,
		filterShorted: shorted
	});
	const holdRange = $derived(pllLockRange(params) / (2 * Math.PI));
	const canLock = $derived(pllCanLock(params));
	const vcoFrequency = $derived(freeRunning + (shorted ? 0 : (VCO_GAIN * control) / (2 * Math.PI)));
	const wrapped = $derived(Math.atan2(Math.sin(phaseError), Math.cos(phaseError)));
	const locked = $derived(canLock && Math.abs(rate) < 0.06);
	const status = $derived(
		locked
			? `locked, phase offset ${((wrapped * 180) / Math.PI).toFixed(0)}°`
			: canLock
				? 'acquiring lock'
				: 'cycle slipping, outside the hold range'
	);

	function step(p: PllParams): void {
		const [a1, b1] = pllDerivatives(phaseError, control, p);
		const [a2, b2] = pllDerivatives(phaseError + (DT / 2) * a1, control + (DT / 2) * b1, p);
		const [a3, b3] = pllDerivatives(phaseError + (DT / 2) * a2, control + (DT / 2) * b2, p);
		const [a4, b4] = pllDerivatives(phaseError + DT * a3, control + DT * b3, p);
		phaseError += (DT / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
		control += (DT / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
		rate = a4;
	}

	function record(): void {
		controlHistory = [...controlHistory.slice(1), control];
		detectorHistory = [...detectorHistory.slice(1), DETECTOR_GAIN * Math.sin(phaseError)];
		orbit = [...orbit.slice(-259), { x: DETECTOR_GAIN * Math.sin(phaseError), y: control }];
	}

	/* Live: about two model milliseconds per second, so a slip is countable. */
	$effect(() => {
		if (motion.animationBlocked) return;
		const p = params;
		let frame = 0;
		const loop = () => {
			for (let index = 0; index < 8; index += 1) step(p);
			record();
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	/* Paused: run the transient at once and keep its last stretch on the instruments. */
	$effect(() => {
		if (!motion.animationBlocked) return;
		const p = params;
		untrack(() => settle(p));
	});

	function settle(p: PllParams): void {
		const recorded: { c: number; d: number }[] = [];
		const points: { x: number; y: number }[] = [];
		for (let index = 0; index < 6000; index += 1) {
			step(p);
			if (index % 8 === 0) {
				recorded.push({ c: control, d: DETECTOR_GAIN * Math.sin(phaseError) });
				points.push({ x: DETECTOR_GAIN * Math.sin(phaseError), y: control });
			}
		}
		controlHistory = recorded.slice(-HISTORY).map((entry) => entry.c);
		detectorHistory = recorded.slice(-HISTORY).map((entry) => entry.d);
		orbit = points.slice(-260);
	}

	$effect(() => {
		const root = host;
		if (!root) return;
		const drive = Math.min(1, Math.abs(control));
		styleWiresFrom(root, 'VC.node', 'stroke-width', (1 + drive * 3).toFixed(2));
		styleWiresFrom(root, 'RF.out', 'stroke-width', (1 + drive * 3).toFixed(2));
		styleWiresFrom(
			root,
			'PD.out1',
			'opacity',
			(0.45 + 0.55 * Math.abs(Math.sin(phaseError))).toFixed(2)
		);
		setNodeDegraded(root, 'CF', shorted);
	});

	const CYCLES = 3;
	const history = (values: readonly number[]) => (x: number) =>
		values[Math.min(values.length - 1, Math.floor(x * (values.length - 1)))] ?? 0;
	const nets = $derived<ProbeNet[]>([
		{
			id: 'ref',
			sources: ['REF.positive'],
			label: 'ref',
			unit: 'V',
			sample: (x, phase) => Math.sin(2 * Math.PI * CYCLES * x - phase),
			summary: () => formatSi(reference * 1e3, 'Hz'),
			reading: () =>
				reading('pll.probe.net', `reference ${formatSi(reference * 1e3, 'Hz')}`, {
					name: 'reference',
					value: formatSi(reference * 1e3, 'Hz')
				})
		},
		{
			id: 'out',
			sources: ['VCO.osc', 'FOUT.node'],
			label: 'VCO',
			unit: 'V',
			/* Drawn against the reference: a locked loop holds the offset, a slipping one slides. */
			sample: (x, phase) => Math.sin(2 * Math.PI * CYCLES * x - phase - phaseError),
			summary: () => formatSi(vcoFrequency * 1e3, 'Hz'),
			reading: () =>
				reading('pll.probe.net', `VCO ${formatSi(vcoFrequency * 1e3, 'Hz')}`, {
					name: 'VCO output',
					value: formatSi(vcoFrequency * 1e3, 'Hz')
				})
		},
		{
			id: 'pd',
			sources: ['PD.out1'],
			label: 'K_d sin θₑ',
			unit: 'V',
			sample: history(detectorHistory),
			summary: () => `${signed(DETECTOR_GAIN * Math.sin(phaseError))} V`,
			reading: () =>
				reading('pll.probe.net', `detector ${signed(Math.sin(phaseError))} volts`, {
					name: 'detector',
					value: `${signed(DETECTOR_GAIN * Math.sin(phaseError))} V`
				})
		},
		{
			id: 'vc',
			sources: ['RF.out', 'VC.node'],
			label: 'v_c',
			unit: 'V',
			sample: history(controlHistory),
			summary: () => `${signed(control)} V`,
			reading: () =>
				reading('pll.probe.net', `control ${signed(control)} volts`, {
					name: 'control voltage',
					value: `${signed(control)} V`
				})
		}
	]);
	const channels = $derived(probeChannels(nets, probeA, probeB));

	const controls = $derived<PartControl[]>([
		{
			id: 'pll-reference',
			node: 'REF',
			label: 'f ref',
			ariaLabel: 'Reference frequency, 8 to 12 kilohertz',
			min: 8,
			max: 12,
			step: 0.01,
			value: reference,
			display: formatSi(reference * 1e3, 'Hz'),
			set: (value) => (reference = value),
			place: 'below'
		},
		{
			id: 'pll-free',
			node: 'VCO',
			label: 'f₀',
			ariaLabel: 'VCO free-running frequency',
			min: 8,
			max: 12,
			step: 0.01,
			value: freeRunning,
			display: formatSi(freeRunning * 1e3, 'Hz'),
			set: (value) => (freeRunning = value),
			place: 'below'
		},
		{
			id: 'pll-filter',
			node: 'RF',
			label: 'R',
			ariaLabel: 'Loop filter resistance',
			min: 3,
			max: 4.6,
			step: 0.01,
			value: logR,
			display: formatSi(resistance, 'Ω'),
			set: (value) => (logR = value),
			place: 'above'
		}
	]);

	const revision = $derived(
		`${reference}:${freeRunning}:${logR}:${shorted}:${probeA}:${probeB}:${controlHistory.at(-1)}`
	);
	const detune = $derived(reference - freeRunning);
</script>

<Bench title={t('Phase-locked loop')} tone="analog" status={t(status)} {stage} {dock} {deck} />

{#snippet stage()}
	<div class="pll-canvas">
		<div
			class="sim-stage pll-stage schemd-frame"
			bind:this={host}
			role="group"
			aria-label={t(
				'Phase-locked loop: reference, XOR phase detector, R C loop filter, and VCO with feedback. Drag the tags on the reference, the resistor, and the VCO; click a wire to probe it.'
			)}
			data-model-stage={timeline.step}
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
			timebase="waves drawn against the reference, rolling traces ≈ 0.25 ms/div"
			{revision}
		/>
	</section>
	<section class="dock-block" aria-label={t('Readouts')}>
		<p class="microlabel">{t('Readouts')}</p>
		<div class="metrics">
			<div>
				<span>{t('VCO')}</span>
				<strong
					><LiveMath
						id="pll.readout.vco"
						label={t('VCO frequency {0}', [formatSi(vcoFrequency * 1e3, 'Hz')])}
						values={{ value: formatSi(vcoFrequency * 1e3, 'Hz') }}
					/></strong
				>
			</div>
			<div>
				<span>{t('Phase error')}</span>
				<strong
					><LiveMath
						id="pll.readout.error"
						label={t('phase error {0} degrees', [((wrapped * 180) / Math.PI).toFixed(0)])}
						values={{ value: ((wrapped * 180) / Math.PI).toFixed(0) }}
					/></strong
				>
			</div>
			<div>
				<span>{t('Control')}</span>
				<strong
					><LiveMath
						id="pll.readout.vc"
						label={t('control voltage {0} volts', [signed(control)])}
						values={{ value: signed(control) }}
					/></strong
				>
			</div>
			<div>
				<span>{t('Hold range')}</span>
				<strong
					><LiveMath
						id="pll.readout.detune"
						label={t('detuning {0} against a hold range of {1}', [
							formatSi(Math.abs(detune) * 1e3, 'Hz'),
							formatSi(holdRange * 1e3, 'Hz')
						])}
						values={{
							detune: formatSi(Math.abs(detune) * 1e3, 'Hz'),
							range: formatSi(holdRange * 1e3, 'Hz')
						}}
					/></strong
				>
			</div>
		</div>
	</section>
	<PhasePortrait
		points={orbit}
		label={locked
			? t('Phase portrait: a fixed point, the loop is locked')
			: t('Phase portrait: the loop is moving')}
		xLabel="detector output"
		yLabel="control voltage"
		xMath={reading('pll.axis.x', 'detector output')}
		yMath={reading('pll.axis.y', 'control voltage')}
	/>
{/snippet}

{#snippet deck()}
	<ProbeSelects {nets} bind:a={probeA} bind:b={probeB} />
	<div class="deck-group">
		<span class="microlabel">{t('Try')}</span>
		<div class="presets">
			<button
				class="btn"
				type="button"
				data-preset="step-reference"
				onclick={() => (reference = Math.min(12, freeRunning + 0.6))}
				>{t('Step the reference +600 Hz')}</button
			>
			<button
				class="btn"
				type="button"
				data-preset="detune"
				onclick={() => (reference = Math.min(12, freeRunning + 1.8))}
				>{t('Detune past the hold range')}</button
			>
		</div>
	</div>
	<div class="deck-group">
		<SimulationMotionControl {motion} label={t('Phase-locked loop animation')} />
	</div>
	<div class="deck-group">
		<FaultSwitch label={t('Loop filter shorted to ground')} bind:active={shorted} />
	</div>
{/snippet}

<style>
	.pll-canvas {
		position: relative;
	}

	.pll-stage :global(svg) {
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
			font: var(--text-xs) / 1.4 var(--font-sans);
			font-variant-numeric: tabular-nums;
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
</style>
