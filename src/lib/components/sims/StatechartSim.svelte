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

	interface Props {
		svg: string;
	}

	let { svg }: Props = $props();

	type State = 'RED' | 'GREEN' | 'YELLOW';
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
	let running = $state(false);
	let progress = $state(0); /* dwell fraction within the active state */
	let speed = $state(1);
	let pulsing = $state<string | undefined>();
	let trace = $state<string[]>(['▸ start → RED']);
	let visits = $state<Record<State, number>>({ RED: 1, GREEN: 0, YELLOW: 0 });
	let faults = $state({ invertedGuard: false });

	const active = $derived(TRANSITIONS.find((transition) => transition.from === current)!);
	/** With the guard inverted, YELLOW's exit never becomes enabled — a deadlock. */
	const deadlocked = $derived(faults.invertedGuard && current === 'YELLOW');

	function fire(): void {
		if (deadlocked) {
			if (ui.audio) playError();
			return;
		}
		const transition = active;
		pulsing = transition.wire;
		current = transition.to;
		progress = 0;
		visits = { ...visits, [transition.to]: visits[transition.to] + 1 };
		trace = [...trace.slice(-11), `${transition.from} —[${transition.event}]→ ${transition.to}`];
		if (ui.audio) playTick(current === 'GREEN' ? 660 : current === 'YELLOW' ? 520 : 440);
		setTimeout(() => (pulsing = undefined), 320);
	}

	function reset(): void {
		current = 'RED';
		progress = 0;
		trace = ['▸ start → RED'];
		visits = { RED: 1, GREEN: 0, YELLOW: 0 };
		if (ui.audio) playTick(560);
	}

	/* Auto-run: accumulate dwell, fire the guarded transition when it expires. */
	$effect(() => {
		if (!running) return;
		let frame = 0;
		let last = performance.now();
		const loop = (now: number): void => {
			const dt = (now - last) * speed;
			last = now;
			if (!deadlocked) {
				progress = Math.min(1, progress + dt / active.dwell);
				if (progress >= 1) fire();
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
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

	function probe(element: Element): string | undefined {
		const id = delegatedNodeId(element);
		if (id === 'RED' || id === 'GREEN' || id === 'YELLOW') {
			return `state ${id} · ${visits[id as State]} visits${id === current ? ' · ACTIVE' : ''}`;
		}
		if (id === 'START') return 'initial pseudostate';
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
			<button type="button" class="btn" aria-pressed={running} onclick={() => (running = !running)}>
				{running ? 'pause' : 'run'}
			</button>
			<button type="button" class="btn btn-solid" onclick={fire} disabled={deadlocked}>
				fire event
			</button>
			<button type="button" class="btn" onclick={reset}>reset</button>
		</div>
		<label>
			<span class="microlabel">time scale = {speed.toFixed(1)}×</span>
			<input type="range" min="0.3" max="3" step="0.1" bind:value={speed} aria-label="Time scale" />
		</label>
		<div class="next-event">
			<span class="microlabel">enabled transition</span>
			{#if deadlocked}
				<span class="deadlock">⛔ deadlocked in YELLOW — no guard enabled</span>
			{:else}
				<span class="guard">{active.from} —[{active.event}]→ {active.to}</span>
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
		aria-label="Executable UML traffic-signal state machine"
	>
		{@html svg}
		<div class="dwell" aria-hidden="true">
			<span style={`width: ${deadlocked ? 100 : progress * 100}%`} class:stalled={deadlocked}
			></span>
		</div>
	</div>
{/snippet}

{#snippet instruments()}
	<div class="current" class:deadlocked>
		<span class="microlabel">active state</span>
		<strong>{current}</strong>
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

	label {
		display: grid;
		gap: 2px;
	}

	input[type='range'] {
		accent-color: var(--accent);
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

	.dwell {
		position: absolute;
		inset-block-end: 0;
		inset-inline: 0;
		block-size: 3px;
		background: var(--bg-inset);

		& span {
			display: block;
			block-size: 100%;
			background: var(--accent);
			transition: width 80ms linear;
		}

		& span.stalled {
			background: var(--danger);
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
