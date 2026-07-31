<script lang="ts">
	/**
	 * Walks a diagram net by net, lighting each one as it is described.
	 *
	 * The transcript is not a fallback — it is always rendered, because an
	 * audio-only affordance is its own accessibility failure. Speech is pure
	 * enhancement layered on top: where the Web Speech API is missing or refused,
	 * every control still works and the text still advances.
	 *
	 * Highlighting goes through `setPropagationFrame`, the same delegated
	 * `data-*` path the simulations use, so this never draws or mutates SVG.
	 */
	import { onDestroy } from 'svelte';
	import { clearPropagationFrame, setPropagationFrame } from '$lib/sim-dom';
	import type { DiagramTour } from '$lib/server/diagram-tour';

	let {
		tour,
		host = $bindable(undefined)
	}: {
		tour: DiagramTour;
		/** The element containing the compiled SVG whose nets should light up. */
		host?: Element;
	} = $props();

	/** -1 is the opening summary; 0..n-1 are nets. */
	let index = $state(-1);
	let playing = $state(false);
	let rate = $state(1);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const current = $derived(index < 0 ? undefined : tour.stops[index]);
	const spoken = $derived(index < 0 ? `${tour.headline} ${tour.inventory}` : (current?.text ?? ''));
	const canSpeak = typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';

	/* Reading pace, used when speech is unavailable so the tour still advances at
	   a rate a reader can follow. Deliberately generous. */
	const MS_PER_CHARACTER = 55;
	const MINIMUM_STOP_MS = 1_600;

	function paint() {
		if (!host) return;
		if (!current) {
			clearPropagationFrame(host);
			return;
		}
		setPropagationFrame(host, { nodes: current.nodes, highNodes: current.nodes });
	}

	function stopSpeech() {
		if (canSpeak) window.speechSynthesis.cancel();
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
	}

	function advance() {
		if (index >= tour.stops.length - 1) {
			playing = false;
			return;
		}
		index += 1;
	}

	/** Speak the current step, then continue if still playing. */
	function announce() {
		stopSpeech();
		if (!playing) return;
		const text = spoken;
		if (canSpeak) {
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.rate = rate;
			utterance.onend = () => {
				if (playing) advance();
			};
			window.speechSynthesis.speak(utterance);
			return;
		}
		/* No speech synthesis: hold each step long enough to read, so the tour is
		   still a tour rather than a flicker. */
		timer = setTimeout(
			() => {
				if (playing) advance();
			},
			Math.max(MINIMUM_STOP_MS, text.length * MS_PER_CHARACTER) / rate
		);
	}

	function toggle() {
		playing = !playing;
		if (!playing) stopSpeech();
	}

	function step(delta: number) {
		playing = false;
		stopSpeech();
		index = Math.min(tour.stops.length - 1, Math.max(-1, index + delta));
	}

	function restart() {
		playing = false;
		stopSpeech();
		index = -1;
	}

	/* Painting follows the index whether the move came from playback or a button,
	   so the diagram can never disagree with the transcript. */
	$effect(() => {
		void index;
		void host;
		paint();
	});

	$effect(() => {
		void index;
		if (playing) announce();
	});

	onDestroy(() => {
		stopSpeech();
		if (host) clearPropagationFrame(host);
	});
</script>

<section class="tour" aria-label="Guided tour of this diagram">
	<div class="controls">
		<button type="button" class="btn primary" onclick={toggle} aria-pressed={playing}>
			{playing ? 'Pause' : 'Play tour'}
		</button>
		<button type="button" class="btn" onclick={() => step(-1)} disabled={index < 0}>
			← Back
		</button>
		<button
			type="button"
			class="btn"
			onclick={() => step(1)}
			disabled={index >= tour.stops.length - 1}
		>
			Next →
		</button>
		<button type="button" class="btn" onclick={restart} disabled={index < 0}>Restart</button>
		<label class="rate">
			Speed
			<select bind:value={rate}>
				<option value={0.75}>0.75×</option>
				<option value={1}>1×</option>
				<option value={1.5}>1.5×</option>
				<option value={2}>2×</option>
			</select>
		</label>
		<span class="progress" aria-hidden="true">
			{index < 0 ? 'Summary' : `Net ${index + 1} / ${tour.stops.length}`}
		</span>
	</div>

	{#if !canSpeak}
		<p class="note">
			This browser offers no speech synthesis, so the tour reads silently — every control still
			works and each step holds long enough to read.
		</p>
	{/if}

	<!-- The transcript is the tour, not a caption for it. `aria-live` announces
	     each step to a screen reader that is not using the browser's own voice. -->
	<ol class="transcript" aria-live="polite">
		<li class:is-current={index < 0}>
			<span class="marker">Summary</span>
			<span class="text">{tour.headline} {tour.inventory}</span>
		</li>
		{#each tour.stops as stop, stopIndex (stop.netId)}
			<li class:is-current={index === stopIndex}>
				<button type="button" class="jump" onclick={() => step(stopIndex - index)}>
					<span class="marker">{stop.name ?? stop.netId}</span>
					<span class="text">{stop.text}</span>
				</button>
			</li>
		{/each}
	</ol>
</section>

<style>
	.tour {
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		background: var(--bg-raised);
		padding: var(--space-4);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-block-end: var(--space-3);
	}
	.primary {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--line-strong));
		color: var(--accent);
	}
	.rate {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.rate select {
		background: var(--bg-inset);
		color: var(--ink);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		padding: 0.15rem 0.3rem;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
	}
	.progress {
		margin-inline-start: auto;
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.note {
		margin: 0 0 var(--space-3);
		font-size: var(--text-sm);
		color: var(--ink-mute);
	}
	.transcript {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.transcript li {
		background: var(--bg-panel);
	}
	.transcript li.is-current {
		background: color-mix(in srgb, var(--accent) 12%, var(--bg-panel));
	}
	.transcript li > .marker,
	.jump {
		display: grid;
		grid-template-columns: minmax(4.5rem, auto) 1fr;
		gap: var(--space-3);
		align-items: baseline;
		inline-size: 100%;
		padding: var(--space-2) var(--space-3);
		text-align: start;
		background: none;
		border: 0;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.transcript li > .marker {
		display: contents;
	}
	.marker {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.is-current .marker {
		color: var(--accent);
	}
	.text {
		font-size: var(--text-sm);
		color: var(--ink);
	}
	.jump:hover {
		background: var(--bg-inset);
	}
	.jump:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	@media (max-width: 620px) {
		.jump,
		.transcript li > .marker {
			grid-template-columns: 1fr;
			gap: var(--space-1);
		}
		.progress {
			margin-inline-start: 0;
		}
	}
	/* A reader who has asked for less motion still gets the tour; what they do
	   not get is the highlight animating between nets. */
	@media (prefers-reduced-motion: reduce) {
		.transcript li {
			transition: none;
		}
	}
</style>
