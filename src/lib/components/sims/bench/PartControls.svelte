<script lang="ts">
	/**
	 * Values tuned on the parts themselves.
	 *
	 * Each tag sits beside its part in the compiled drawing and is a real range
	 * input under a visible pill, so dragging the tag, the arrow keys, and a
	 * screen reader all reach the same slider. Where the stage is too narrow for
	 * tags to sit beside small parts without colliding, the same inputs line up
	 * under the drawing instead.
	 */
	import { nodeElements, setNodeClass } from '#lib/sim-dom.ts';
	import type { PartControl } from './types';

	interface Props {
		/** The element holding the compiled SVG. */
		host: HTMLElement | undefined;
		controls: readonly PartControl[];
	}

	let { host, controls }: Props = $props();

	let layer = $state<HTMLDivElement | undefined>();
	let width = $state(0);
	let places = $state<Record<string, { x: number; y: number }>>({});
	/* Roughly half a tag's width; tags are short (a label and a value). */
	const TAG_HALF = 64;
	const docked = $derived(width > 0 && width < 640);

	function measure(): void {
		if (!host || !layer) return;
		const frame = layer.getBoundingClientRect();
		width = frame.width;
		const next: Record<string, { x: number; y: number }> = {};
		for (const control of controls) {
			const boxes = nodeElements(host, control.node).map((node) => node.getBoundingClientRect());
			if (!boxes.length) continue;
			const left = Math.min(...boxes.map((box) => box.left)) - frame.left;
			const right = Math.max(...boxes.map((box) => box.right)) - frame.left;
			const top = Math.min(...boxes.map((box) => box.top)) - frame.top;
			const bottom = Math.max(...boxes.map((box) => box.bottom)) - frame.top;
			const place = control.place ?? 'below';
			/* Keep a centred tag's half-width inside the stage, so none hangs off its edge. */
			const clampX = (x: number) =>
				Math.min(Math.max(x, TAG_HALF), Math.max(TAG_HALF, frame.width - TAG_HALF));
			next[control.id] =
				place === 'above'
					? { x: clampX((left + right) / 2), y: top - 8 }
					: place === 'left'
						? { x: Math.max(left - 8, TAG_HALF * 2), y: (top + bottom) / 2 }
						: place === 'right'
							? { x: Math.min(right + 8, frame.width - TAG_HALF * 2), y: (top + bottom) / 2 }
							: { x: clampX((left + right) / 2), y: bottom + 8 };
		}
		places = next;
	}

	$effect(() => {
		void controls.length;
		if (!host || !layer) return;
		const observer = new ResizeObserver(() => measure());
		observer.observe(layer);
		observer.observe(host);
		measure();
		document.fonts?.ready.then(measure);
		return () => observer.disconnect();
	});

	const percent = (control: PartControl) =>
		((control.value - control.min) / (control.max - control.min)) * 100;
	const tune = (control: PartControl, on: boolean) => {
		if (host) setNodeClass(host, control.node, 'is-tuning', on);
	};
</script>

<div class="part-layer" class:docked bind:this={layer}>
	{#each controls as control (control.id)}
		{@const at = places[control.id]}
		<label
			class="part-tag place-{control.place ?? 'below'}"
			for={control.id}
			style={!docked && at ? `left:${at.x}px;top:${at.y}px` : undefined}
			hidden={width === 0 || (!docked && !at)}
			onpointerenter={() => tune(control, true)}
			onpointerleave={() => tune(control, false)}
		>
			<span class="tag-label">{control.label}</span>
			<span class="tag-value">{control.display}</span>
			<span class="tag-track" aria-hidden="true"><i style={`width:${percent(control)}%`}></i></span>
			<input
				id={control.id}
				type="range"
				min={control.min}
				max={control.max}
				step={control.step}
				value={control.value}
				aria-label={control.ariaLabel}
				aria-valuetext={control.display}
				oninput={(event) => control.set(Number(event.currentTarget.value))}
				onchange={control.change}
				onfocus={() => tune(control, true)}
				onblur={() => tune(control, false)}
			/>
		</label>
	{/each}
</div>

<style>
	.part-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.part-tag {
		position: absolute;
		z-index: 2;
		display: grid;
		grid-template-columns: auto auto;
		align-items: baseline;
		gap: 0 6px;
		padding: 4px 8px 6px;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--bg-raised) 92%, transparent);
		box-shadow: 0 6px 18px -10px rgb(0 0 0 / 0.55);
		font-family: var(--font-mono);
		white-space: nowrap;
		pointer-events: auto;
		cursor: ew-resize;
		/* Border only: a transform transition would sweep a tag in from its
		   overlay offset when the stage docks the tags on a narrow screen. */
		transition: border-color var(--dur-fast) var(--ease-precise);
	}

	.place-below {
		transform: translate(-50%, 0);
	}
	.place-above {
		transform: translate(-50%, -100%);
	}
	.place-left {
		transform: translate(-100%, -50%);
	}
	.place-right {
		transform: translate(0, -50%);
	}

	.part-tag:hover,
	.part-tag:focus-within {
		border-color: var(--accent);
	}

	.part-tag:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.tag-label {
		font-size: var(--text-2xs);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink-mute);
	}

	.tag-value {
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}

	.tag-track {
		grid-column: 1 / -1;
		block-size: 2px;
		margin-block-start: 4px;
		background: var(--line);

		& i {
			display: block;
			block-size: 100%;
			background: var(--accent);
		}
	}

	/* The real control: invisible, covering the pill, so a drag anywhere on the
	   tag moves the value. */
	input {
		position: absolute;
		inset: 0;
		inline-size: 100%;
		block-size: 100%;
		margin: 0;
		opacity: 0;
		cursor: ew-resize;
	}

	.docked {
		position: static;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: var(--space-3);
		border-block-start: 1px solid var(--line);
		pointer-events: auto;

		& .part-tag {
			position: relative;
			transform: none;
			flex: 1 1 140px;
		}
	}
</style>
