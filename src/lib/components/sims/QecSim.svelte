<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();

	/**
	 * 3-qubit bit-flip quantum error-correction code.
	 *
	 * Because the code only defends against X (bit-flip) errors, its action is
	 * captured exactly by a classical error vector over GF(2): encoding is
	 * perfect, an error toggles one physical line, and the syndrome is a pair of
	 * parities that never reveals the protected amplitudes. The decoder looks the
	 * syndrome up and flips the accused qubit back. Logical fidelity is 1 only
	 * when the residual error is trivial — which a miswired decoder breaks.
	 */
	import { setNodeActive, setNodeDegraded, setWiresFrom, delegatedNodeId } from '#lib/sim-dom.ts';
	import { playSuccess, playError, playTick } from '#lib/audio.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import FaultSwitch from './FaultSwitch.svelte';
	import LiveMath from './LiveMath.svelte';
	import { reading, type MathReading } from '#lib/simulation-math.ts';
	import {
		qecAccused,
		qecFidelity,
		qecResidual,
		qecSyndrome,
		type QecError
	} from '#lib/simulation-models.ts';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';
	import Bench from './bench/Bench.svelte';
	import PartReadout from './bench/PartReadout.svelte';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	let host = $state<HTMLElement | undefined>();
	/** Physical bit-flip error on each of the three code qubits. */
	let error = $state<QecError>([0, 0, 0]);
	let faults = $state({ miswiredDecoder: false });
	const timeline = useSimulationTimelineModel();
	const NO_ERROR: QecError = [0, 0, 0];

	/** Syndrome parities: (q0⊕q1, q1⊕q2). Reveal disagreement, never values. */
	const visibleError = $derived(timeline.step >= 2 ? error : NO_ERROR);
	const syndrome = $derived(timeline.step >= 3 ? qecSyndrome(error) : ([0, 0] as const));
	const accused = $derived(qecAccused(syndrome, faults.miswiredDecoder));
	const corrected = $derived(timeline.step >= 4);
	const residual = $derived(qecResidual(visibleError, corrected, faults.miswiredDecoder));
	const fidelity = $derived(qecFidelity(visibleError, corrected, faults.miswiredDecoder));
	const syndromeLabel = $derived(`${syndrome[0]}${syndrome[1]}`);

	function inject(qubit: number): void {
		const next: [0 | 1, 0 | 1, 0 | 1] = [...error];
		next[qubit] = (next[qubit]! ^ 1) as 0 | 1;
		error = next;
		if (ui.audio) playError();
	}

	function correct(): void {
		const projectedFidelity = qecFidelity(error, true, faults.miswiredDecoder);
		timeline.command('seek', 4);
		if (ui.audio) (projectedFidelity === 1 ? playSuccess : playError)();
	}

	function reset(): void {
		error = [0, 0, 0];
		timeline.command('reset');
		if (ui.audio) playTick(560);
	}

	/* Paint the pipeline state into the compiled schematic. */
	$effect(() => {
		const root = host;
		if (!root) return;
		const anyError = visibleError.some((bit) => bit === 1);
		setNodeActive(root, 'ENC', timeline.step >= 1);
		setNodeActive(root, 'ERR', timeline.step >= 2 && anyError);
		setNodeDegraded(root, 'ERR', anyError && !corrected);
		for (let index = 0; index < 3; index += 1) {
			setWiresFrom(
				root,
				`ERR.o${index}`,
				timeline.step >= 2 && visibleError[index] === 1 && !corrected
			);
			setWiresFrom(root, `ENC.o${index}`, timeline.step >= 1);
		}
		setNodeActive(root, 'SYN', timeline.step >= 3 && (syndrome[0] === 1 || syndrome[1] === 1));
		setNodeActive(root, 'COR', timeline.step >= 4);
		setNodeDegraded(root, 'COR', corrected && fidelity === 0);
		setNodeActive(root, 'MOUT', timeline.step >= 5 && fidelity === 1);
	});

	function probe(element: Element): MathReading | undefined {
		const id = delegatedNodeId(element);
		if (id === 'ENC')
			return reading('qec.encode', 'encode psi into the three-qubit repetition code');
		if (id === 'ERR')
			return reading(
				'qec.error',
				visibleError.some((b) => b)
					? `bit flip on qubit ${visibleError.findIndex((b) => b === 1)}`
					: 'no error',
				{
					qubit: visibleError.some((b) => b) ? visibleError.findIndex((b) => b === 1) : '—',
					state: visibleError.some((b) => b) ? 'bit flip' : 'no error'
				}
			);
		if (id === 'SYN')
			return reading('qec.syndrome', `syndrome ${syndromeLabel}`, { value: syndromeLabel });
		if (id === 'COR')
			return reading(
				'qec.correction',
				accused === undefined ? 'no correction needed' : `flip qubit ${accused} back`,
				{
					qubit: accused ?? '—',
					state: accused === undefined ? 'no correction needed' : 'apply correction'
				}
			);
		if (id === 'MOUT')
			return reading('qec.fidelity', `logical fidelity ${fidelity}`, { value: fidelity });
		return undefined;
	}
</script>

<Bench
	title={t('Quantum error correction')}
	tone="quantum"
	status={t('syndrome {0}, fidelity {1}', [syndromeLabel, fidelity])}
	hint={t(
		'Inject a bit flip, then step the timeline through syndrome, decode, and correct. Click a qubit or gate to read it.'
	)}
	stage={canvas}
	dock={instruments}
	deck={controls}
/>

{#snippet controls()}
	<div class="stack">
		<p class="control-note">
			{t('Inject a bit-flip on any physical qubit. The two')} <strong>{t('Parity')}</strong>
			{t('checks name the culprit without ever reading')}
			<strong><LiveMath id="qec.amplitudes" label={t('alpha or beta')} /></strong>{t(
				'. Then correct and read the fidelity.'
			)}
		</p>
		<div class="inject-row">
			{#each [0, 1, 2] as qubit (qubit)}
				<button
					type="button"
					data-timeline-input
					class="btn"
					class:flipped={error[qubit] === 1}
					onclick={() => inject(qubit)}
				>
					<LiveMath
						id="qec.error"
						label={t('X on qubit {0}', [qubit])}
						values={{ qubit, state: '' }}
					/>
				</button>
			{/each}
		</div>
		<div class="button-row">
			<button type="button" class="btn btn-solid" onclick={correct}>{t('extract & correct')}</button
			>
			<button type="button" class="btn" onclick={reset}>{t('reset')}</button>
		</div>
	</div>
	<div class="switchboard">
		<p class="microlabel">{t('Fault injection')}</p>
		<FaultSwitch label={t('Syndrome decoder miswired')} bind:active={faults.miswiredDecoder} />
	</div>
{/snippet}

{#snippet canvas()}
	<div
		class="sim-stage schemd-frame"
		bind:this={host}
		role="group"
		data-model-stage={timeline.step}
		aria-label={t('Quantum error-correction model')}
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<p class="visually-hidden" aria-live="polite" aria-atomic="true">
		{t('Error-correction decoder')}
		{faults.miswiredDecoder ? t('degraded: wiring fault active') : t('nominal')}{t('; syndrome')}
		{t(syndromeLabel)}; {corrected
			? t('correction applied, residual pattern {0}, logical fidelity {1}', [
					residual.join(''),
					fidelity
				])
			: accused === undefined
				? t('no correction requested')
				: t('decoder accuses qubit {0}', [accused])}.
	</p>
	<div class="qubits" aria-label={t('Physical qubit states')}>
		{#each visibleError as bit, index (index)}
			<div class="qwire" class:flipped={bit === 1 && !corrected}>
				<span class="microlabel"
					><LiveMath
						id="qec.qubit"
						label={t('qubit {0}', [index])}
						values={{ value: index }}
					/></span
				>
				<span class="qstate">{bit === 1 && !corrected ? t('X') : t('·')}</span>
			</div>
		{/each}
	</div>
	<div class="syndrome">
		<span class="microlabel">{t('Syndrome')}</span>
		<div class="syn-bits">
			<span class="syn" class:hot={syndrome[0] === 1}
				><LiveMath
					id="qec.syndrome.bit"
					label={t('syndrome bit zero {0}', [syndrome[0]])}
					values={{ index: 0, value: syndrome[0] }}
				/></span
			>
			<span class="syn" class:hot={syndrome[1] === 1}
				><LiveMath
					id="qec.syndrome.bit"
					label={t('syndrome bit one {0}', [syndrome[1]])}
					values={{ index: 1, value: syndrome[1] }}
				/></span
			>
		</div>
		<span class="decode"
			><LiveMath
				id="qec.decode"
				label={accused === undefined ? t('no error detected') : t('flip qubit {0}', [accused])}
				values={{
					state: accused === undefined ? 'no error detected' : 'correction',
					qubit: accused ?? '—'
				}}
			/></span
		>
	</div>
	<div
		class="fidelity"
		class:ok={corrected && fidelity === 1}
		class:bad={corrected && fidelity === 0}
	>
		<span class="microlabel">{t('Logical fidelity')}</span>
		<div class="fid-bar"><span style={`width: ${fidelity * 100}%`}></span></div>
		<strong
			><LiveMath
				id="qec.fidelity"
				label={corrected
					? t('logical fidelity {0}', [fidelity])
					: t('logical fidelity unavailable')}
				values={{ value: corrected ? fidelity.toFixed(0) : '—' }}
			/></strong
		>
	</div>
	<PartReadout {host} read={probe} />
{/snippet}

<style>
	.stack,
	.switchboard {
		display: grid;
		gap: var(--space-2);
	}

	.control-note {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--ink-mute);

		& strong {
			color: var(--ink);
			font-weight: 600;
		}
	}

	.inject-row,
	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.btn.flipped {
		border-color: var(--danger);
		color: var(--danger);
	}

	.qubits {
		display: flex;
		gap: var(--space-2);
	}

	.qwire {
		flex: 1;
		display: grid;
		justify-items: center;
		gap: 2px;
		padding: var(--space-2);
		border: 1px solid var(--line);
		background: var(--bg-inset);
	}

	.qwire.flipped {
		border-color: var(--danger);
	}

	.qstate {
		font-family: var(--font-mono);
		font-size: var(--text-md);
		color: var(--ink-faint);
	}

	.qwire.flipped .qstate {
		color: var(--danger);
	}

	.syndrome {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-3);
		border: 1px solid var(--line);
		background: var(--bg-inset);
	}

	.syn-bits {
		display: flex;
		gap: var(--space-3);
	}

	.syn {
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
		font-size: var(--text-sm);
		color: var(--ink-faint);
	}

	.syn.hot {
		color: var(--accent);
	}

	.decode {
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
		font-size: var(--text-xs);
		color: var(--accent-2);
	}

	.fidelity {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-3);
		border: 1px solid var(--line-strong);
		background: var(--bg-inset);
	}

	.fidelity.ok {
		border-color: var(--ok);
	}

	.fidelity.bad {
		border-color: var(--danger);
	}

	.fid-bar {
		block-size: 6px;
		background: var(--bg-panel);
		border: 1px solid var(--line);

		& span {
			display: block;
			block-size: 100%;
			background: var(--ok);
			transition: width var(--dur-med) var(--ease-precise);
		}
	}

	.fidelity.bad .fid-bar span {
		background: var(--danger);
	}

	.fidelity strong {
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}

	.sim-stage {
		:global([data-node-id].is-active) {
			filter: drop-shadow(0 0 5px var(--glow));
		}

		:global([data-wire-source].is-active) {
			filter: drop-shadow(0 0 4px var(--glow));
		}
	}
</style>
