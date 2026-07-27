<script lang="ts">
	/**
	 * Executable UML state machine — a traffic-signal controller.
	 *
	 * The compiled schematic is a genuine UML statechart (initial pseudostate,
	 * three states, four guarded transitions). This engine is the transition
	 * function δ: a token sits on the active state, guarded events advance it, and
	 * the taken transition pulses. Inverting a guard strands the token — a
	 * deadlock you watch happen rather than read about.
	 */
	import { setNodeActive, setWiresFrom, delegatedNodeId } from '$lib/sim-dom';
	import { playTick, playError } from '$lib/audio';
	import { ui } from '$lib/ui.svelte';
	import LabShell from './LabShell.svelte';
	import FaultSwitch from './FaultSwitch.svelte';
	import ProbeHud from './ProbeHud.svelte';
	import LiveMath from './LiveMath.svelte';
	import { createSimulationMotion } from './simulation-motion.svelte';
	import { reading, type MathReading } from '$lib/simulation-math';
	import { nextTrafficState, type TrafficState as State } from '$lib/simulation-models';
	import { useSimulationTimelineModel } from './simulation-timeline.svelte';

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	interface Transition {
		readonly from: State;
		readonly to: State;
		readonly event: string;
		/** Wire source endpoint that pulses when this transition fires. */
		readonly wire: string;
		readonly dwell: number;
	}

	/** δ as data: the guarded edges of the machine, in cycle order. */
	const TRANSITIONS: readonly Transition[] = [
		{ from: 'RED', to: 'GREEN', event: 't > T_red', wire: 'RED.right', dwell: 3000 },
		{ from: 'GREEN', to: 'YELLOW', event: 't > T_green', wire: 'GREEN.bottom', dwell: 3000 },
		{ from: 'YELLOW', to: 'RED', event: 't > T_yellow', wire: 'YELLOW.left', dwell: 1200 }
	];

	let host = $state<HTMLElement | undefined>();
	let current = $state<State>('RED');
	let pulsing = $state<string | undefined>();
	let trace = $state<string[]>(['▸ start → RED']);
	let visits = $state<Record<State, number>>({ RED: 1, GREEN: 0, YELLOW: 0 });
	let faults = $state({ invertedGuard: false });
	const motion = createSimulationMotion('State-machine auto-run');
	const timeline = useSimulationTimelineModel();
	const running = $derived(timeline.playing);

	const active = $derived(TRANSITIONS.find((transition) => transition.from === current)!);
	const autoRunning = $derived(running && !motion.animationBlocked);
	/** With the guard inverted, YELLOW's exit never becomes enabled — a deadlock. */
	const deadlocked = $derived(
		faults.invertedGuard && nextTrafficState(current, faults.invertedGuard) === current
	);

	function fire(): void {
		if (deadlocked) {
			if (ui.audio) playError();
			return;
		}
		if (timeline.step >= TRANSITIONS.length) {
			timeline.command('seek', 1);
		} else {
			timeline.command('next');
		}
	}

	function reset(): void {
		timeline.command('reset');
		if (ui.audio) playTick(560);
	}

	function toggleRunning(): void {
		if (autoRunning) {
			timeline.command('pause');
			return;
		}
		if (motion.paused) motion.toggle();
		timeline.command('play');
	}

	/* The universal causal clock owns both manual seeking and auto-run. Rebuild
	 * from RED for every requested stage so Previous is deterministic and never
	 * applies a transition twice. */
	$effect(() => {
		const requested = Math.max(0, Math.min(TRANSITIONS.length, timeline.step));
		let state: State = 'RED';
		const nextTrace = ['▸ start → RED'];
		const nextVisits: Record<State, number> = { RED: 1, GREEN: 0, YELLOW: 0 };
		let lastWire: string | undefined;
		for (let index = 0; index < requested; index += 1) {
			const transition = TRANSITIONS[index];
			if (!transition || transition.from !== state) break;
			const next = nextTrafficState(state, faults.invertedGuard);
			if (next === state) {
				nextTrace.push(`${state} —[${transition.event}]→ blocked`);
				break;
			}
			state = next;
			lastWire = transition.wire;
			nextVisits[state] += 1;
			nextTrace.push(`${transition.from} —[${transition.event}]→ ${state}`);
		}
		const changed = state !== current;
		current = state;
		visits = nextVisits;
		trace = nextTrace;
		pulsing = lastWire;
		if (changed && ui.audio) playTick(state === 'GREEN' ? 660 : state === 'YELLOW' ? 520 : 440);
		const timer = setTimeout(() => {
			if (pulsing === lastWire) pulsing = undefined;
		}, 320);
		return () => {
			clearTimeout(timer);
		};
	});

	/* Reduced-motion remains an opt-in: the shared Play control cannot bypass it. */
	$effect(() => {
		if (motion.animationBlocked && timeline.playing) timeline.command('pause');
	});

	/* Paint the token and the pulsing transition into the schematic. */
	$effect(() => {
		const root = host;
		if (!root) return;
		for (const state of ['RED', 'GREEN', 'YELLOW'] as const) {
			setNodeActive(root, state, state === current);
			root
				.querySelector(`[data-node-id="${state}"]`)
				?.classList.toggle('is-selected', state === current);
		}
		for (const transition of TRANSITIONS) {
			setWiresFrom(root, transition.wire, transition.wire === pulsing);
		}
		root.querySelector('[data-node-id="YELLOW"]')?.classList.toggle('is-degraded', deadlocked);
	});

	function probe(element: Element): MathReading | undefined {
		const id = delegatedNodeId(element);
		if (id === 'RED' || id === 'GREEN' || id === 'YELLOW') {
			return reading(
				'statechart.probe.state',
				`state ${id}, ${visits[id as State]} visits${id === current ? ', active' : ''}`,
				{ name: id, visits: visits[id as State], status: id === current ? 'ACTIVE' : '' }
			);
		}
		if (id === 'START') return reading('statechart.probe.initial', 'initial pseudostate');
		return undefined;
	}
</script>

<LabShell {controls} {canvas} {instruments} />
<ProbeHud read={probe} />

{#snippet controls()}
	<div class="stack">
		<p class="control-note">
			The token sits on the <strong>active state</strong>. Let the guarded timers run, or fire the
			next event by hand — the diagram <em>is</em> the machine.
		</p>
		<div class="button-row">
			<button
				type="button"
				class="btn"
				aria-pressed={!autoRunning}
				aria-label={`${autoRunning ? 'Pause' : 'Resume'} state-machine auto-run animation`}
				onclick={toggleRunning}
			>
				{autoRunning ? 'pause auto-run' : 'run state machine'}
			</button>
			<button type="button" class="btn btn-solid" onclick={fire} disabled={deadlocked}>
				fire event
			</button>
			<button type="button" class="btn" onclick={reset}>reset</button>
		</div>
		{#if motion.reducedMotion && motion.paused}
			<p class="control-note" role="status">
				State-machine animation is paused for your reduced-motion preference. “Run state machine”
				starts it explicitly.
			</p>
		{/if}
		<p class="control-note">
			Auto-run uses the causal stage delay configured in the timeline above.
		</p>
		<div class="next-event">
			<span class="microlabel">enabled transition</span>
			{#if deadlocked}
				<span class="deadlock">⛔ deadlocked in YELLOW — no guard enabled</span>
			{:else}
				<span class="guard"
					><LiveMath
						id="statechart.guard"
						label={`${active.from} to ${active.to} when ${active.event}`}
						values={{ from: active.from, guard: active.event, to: active.to }}
					/></span
				>
			{/if}
		</div>
	</div>
	<div class="switchboard">
		<p class="microlabel">switchboard · fault injection</p>
		<FaultSwitch label="YELLOW exit guard inverted (deadlock)" bind:active={faults.invertedGuard} />
	</div>
{/snippet}

{#snippet canvas()}
	<div
		class="sim-stage schemd-frame"
		bind:this={host}
		role="group"
		data-model-stage={timeline.step}
		aria-label="Executable UML traffic-signal state machine"
	>
		{@html svg}
	</div>
{/snippet}

{#snippet instruments()}
	<div class="current" class:deadlocked aria-live="polite" aria-atomic="true">
		<span class="microlabel">active state</span>
		<strong>{current}</strong>
		<span class="visually-hidden"
			>{deadlocked ? 'No exit guard is enabled; state machine deadlocked.' : ''}
			{autoRunning ? 'Auto-run active.' : 'Auto-run paused.'}</span
		>
	</div>
	<div class="residency">
		<span class="microlabel">state residency</span>
		{#each ['RED', 'GREEN', 'YELLOW'] as const as state (state)}
			<div class="res-row">
				<span class="res-name">{state}</span>
				<div class="res-bar">
					<span style={`width: ${Math.min(100, visits[state] * 12)}%`}></span>
				</div>
				<span class="res-count">{visits[state]}</span>
			</div>
		{/each}
	</div>
	<div class="trace" aria-label="Event trace log">
		<span class="microlabel">event trace</span>
		<ol>
			{#each trace as entry, index (index)}
				<li>{entry}</li>
			{/each}
		</ol>
	</div>
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

	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.button-row .btn[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--accent);
	}

	.next-event {
		display: grid;
		gap: 2px;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		background: var(--bg-inset);
	}

	.guard {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--accent-2);
	}

	.deadlock {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--danger);
	}

	.sim-stage {
		position: relative;

		:global(svg) {
			min-inline-size: 900px;
		}

		:global([data-node-id].is-selected) {
			filter: drop-shadow(0 0 8px var(--glow));
		}

		:global([data-wire-source].is-active) {
			filter: drop-shadow(0 0 6px var(--glow));
		}
	}

	.current {
		display: grid;
		gap: 2px;
		padding: var(--space-3);
		border: 1px solid var(--line-strong);
		background: var(--bg-inset);

		& strong {
			font-family: var(--font-mono);
			font-size: var(--text-lg);
			color: var(--accent-2);
		}

		&.deadlocked {
			border-color: var(--danger);

			& strong {
				color: var(--danger);
			}
		}
	}

	.residency {
		display: grid;
		gap: var(--space-1);
	}

	.res-row {
		display: grid;
		grid-template-columns: 3.4rem minmax(0, 1fr) 1.4rem;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-mute);
	}

	.res-bar {
		block-size: 6px;
		background: var(--bg-inset);
		border: 1px solid var(--line);

		& span {
			display: block;
			block-size: 100%;
			background: var(--accent-2);
			transition: width var(--dur-med) var(--ease-precise);
		}
	}

	.trace {
		display: grid;
		gap: var(--space-1);

		& ol {
			list-style: none;
			margin: 0;
			padding: var(--space-2);
			display: grid;
			gap: 2px;
			max-block-size: 168px;
			overflow-y: auto;
			background: var(--bg-inset);
			border: 1px solid var(--line);
			font-family: var(--font-mono);
			font-size: var(--text-2xs);
			color: var(--ink-mute);
		}

		& li:last-child {
			color: var(--accent);
		}
	}
</style>
