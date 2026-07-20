<script lang="ts">
	/**
	 * Reusable VS Code-style workspace shell.
	 *
	 * Single responsibility: pane geometry. Content arrives as snippets, so the
	 * shell knows nothing about editors or previews (SOLID: the docs shell and
	 * the playground share this one component). Every pane can shrink, collapse
	 * completely via its drag handle, or be toggled from the status bar.
	 *
	 * Resizing uses native Pointer Events with `setPointerCapture`, mapping
	 * drag deltas straight into CSS grid custom properties. Svelte 5's
	 * fine-grained runes update only the grid-template — no layout thrash,
	 * transitions stay at 60 FPS.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		left?: Snippet;
		center: Snippet;
		right?: Snippet;
		statusExtra?: Snippet;
		leftLabel?: string;
		rightLabel?: string;
		leftInitial?: number;
		rightInitial?: number;
		leftMin?: number;
		rightMin?: number;
		leftOpen?: boolean;
		rightOpen?: boolean;
	}

	let {
		left,
		center,
		right,
		statusExtra,
		leftLabel = 'Explorer',
		rightLabel = 'Preview',
		leftInitial = 240,
		rightInitial = 420,
		leftMin = 160,
		rightMin = 240,
		leftOpen = $bindable(true),
		rightOpen = $bindable(true)
	}: Props = $props();

	let leftWidthOverride = $state<number | undefined>();
	let rightWidthOverride = $state<number | undefined>();
	const leftWidth = $derived(leftWidthOverride ?? leftInitial);
	const rightWidth = $derived(rightWidthOverride ?? rightInitial);
	let dragging = $state<'left' | 'right' | undefined>();

	const COLLAPSE_THRESHOLD = 80;

	const gridTemplate = $derived.by(() => {
		const leftCol = left ? (leftOpen ? `${leftWidth}px 1px` : '0px 1px') : '';
		const rightCol = right ? (rightOpen ? `1px ${rightWidth}px` : '1px 0px') : '';
		return `${leftCol} minmax(0, 1fr) ${rightCol}`.trim();
	});

	/** Begin a pointer-captured drag on one handle. */
	function startDrag(side: 'left' | 'right', event: PointerEvent): void {
		const handle = event.currentTarget;
		if (!(handle instanceof HTMLElement)) return;
		handle.setPointerCapture(event.pointerId);
		dragging = side;
		const startX = event.clientX;
		const startWidth = side === 'left' ? leftWidth : rightWidth;

		const onMove = (move: PointerEvent): void => {
			const delta = side === 'left' ? move.clientX - startX : startX - move.clientX;
			const next = startWidth + delta;
			if (side === 'left') {
				if (!leftOpen && next > COLLAPSE_THRESHOLD) leftOpen = true;
				if (next < COLLAPSE_THRESHOLD) leftOpen = false;
				else leftWidthOverride = Math.max(leftMin, Math.min(next, window.innerWidth * 0.5));
			} else {
				if (!rightOpen && next > COLLAPSE_THRESHOLD) rightOpen = true;
				if (next < COLLAPSE_THRESHOLD) rightOpen = false;
				else rightWidthOverride = Math.max(rightMin, Math.min(next, window.innerWidth * 0.7));
			}
		};

		const onUp = (): void => {
			dragging = undefined;
			handle.removeEventListener('pointermove', onMove);
			handle.removeEventListener('pointerup', onUp);
			handle.removeEventListener('pointercancel', onUp);
		};

		handle.addEventListener('pointermove', onMove);
		handle.addEventListener('pointerup', onUp);
		handle.addEventListener('pointercancel', onUp);
	}

	/** Keyboard resizing for the same handles — full keyboard parity. */
	function keyResize(side: 'left' | 'right', event: KeyboardEvent): void {
		const step = event.shiftKey ? 48 : 16;
		const grow = side === 'left' ? event.key === 'ArrowRight' : event.key === 'ArrowLeft';
		const shrink = side === 'left' ? event.key === 'ArrowLeft' : event.key === 'ArrowRight';
		if (!grow && !shrink && event.key !== 'Enter') return;
		event.preventDefault();
		if (event.key === 'Enter') {
			if (side === 'left') leftOpen = !leftOpen;
			else rightOpen = !rightOpen;
			return;
		}
		const delta = grow ? step : -step;
		if (side === 'left') {
			const next = leftWidth + delta;
			if (next < COLLAPSE_THRESHOLD) leftOpen = false;
			else {
				leftOpen = true;
				leftWidthOverride = Math.max(leftMin, next);
			}
		} else {
			const next = rightWidth + delta;
			if (next < COLLAPSE_THRESHOLD) rightOpen = false;
			else {
				rightOpen = true;
				rightWidthOverride = Math.max(rightMin, next);
			}
		}
	}
</script>

<div class="workspace" class:dragging style={`grid-template-columns: ${gridTemplate}`}>
	{#if left}
		<section class="pane pane-left" aria-label={leftLabel} data-open={leftOpen}>
			{@render left()}
		</section>
		<button
			type="button"
			class="handle"
			aria-label={`Resize ${leftLabel}. Arrow keys resize, Enter toggles.`}
			aria-pressed={leftOpen}
			onpointerdown={(event) => startDrag('left', event)}
			onkeydown={(event) => keyResize('left', event)}
		></button>
	{/if}

	<section class="pane pane-center">
		{@render center()}
	</section>

	{#if right}
		<button
			type="button"
			class="handle"
			aria-label={`Resize ${rightLabel}. Arrow keys resize, Enter toggles.`}
			aria-pressed={rightOpen}
			onpointerdown={(event) => startDrag('right', event)}
			onkeydown={(event) => keyResize('right', event)}
		></button>
		<section class="pane pane-right" aria-label={rightLabel} data-open={rightOpen}>
			{@render right()}
		</section>
	{/if}
</div>

<footer class="statusbar">
	{#if left}
		<button type="button" aria-pressed={leftOpen} onclick={() => (leftOpen = !leftOpen)}>
			⧉ {leftLabel}
		</button>
	{/if}
	{#if right}
		<button type="button" aria-pressed={rightOpen} onclick={() => (rightOpen = !rightOpen)}>
			⧉ {rightLabel}
		</button>
	{/if}
	{#if statusExtra}
		<div class="status-extra">
			{@render statusExtra()}
		</div>
	{/if}
</footer>

<style>
	.workspace {
		display: grid;
		block-size: calc(100vh - var(--header-h) - var(--statusbar-h));
		overflow: hidden;

		&.dragging {
			cursor: col-resize;
			user-select: none;
		}
	}

	.pane {
		min-inline-size: 0;
		overflow: hidden;
		display: grid;
		grid-template-rows: minmax(0, 1fr);
		background: var(--bg);
	}

	.pane-left,
	.pane-right {
		background: var(--bg-raised);
		transition: opacity var(--dur-fast) var(--ease-precise);

		&[data-open='false'] {
			/* visibility removes the collapsed pane's controls from the tab order
			 * and accessibility tree; opacity alone leaves invisible tab stops.
			 * The delay applies only while closing, so reopening shows instantly. */
			opacity: 0;
			visibility: hidden;
			pointer-events: none;
			transition:
				opacity var(--dur-fast) var(--ease-precise),
				visibility 0s linear var(--dur-fast);
		}
	}

	.handle {
		position: relative;
		z-index: 2;
		inline-size: 24px;
		justify-self: center;
		background: transparent;
		cursor: col-resize;
		touch-action: none;

		/* A 24 px control overlays the 1 px structural grid track. */
		&::before {
			content: '';
			position: absolute;
			inset-block: 0;
			inset-inline-start: calc(50% - 0.5px);
			inline-size: 1px;
			background: var(--line);
		}

		&::after {
			content: '';
			position: absolute;
			inset: 0;
		}

		&:hover::before,
		&:focus-visible::before {
			background: var(--accent);
		}
	}

	.statusbar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		block-size: var(--statusbar-h);
		padding-inline: var(--space-2);
		background: var(--bg-raised);
		border-block-start: 1px solid var(--line);
		font-family: var(--font-mono);
		font-size: var(--text-2xs);

		& > button {
			padding: 0.1rem 0.5rem;
			color: var(--ink-faint);
			letter-spacing: 0.06em;

			&[aria-pressed='true'] {
				color: var(--accent);
			}

			&:hover {
				color: var(--ink);
			}
		}
	}

	.status-extra {
		margin-inline-start: auto;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-inline-size: 0;
		overflow: hidden;
	}

	@media (max-width: 860px) {
		.workspace {
			display: flex;
			flex-direction: column;
			block-size: auto;
			overflow: visible;
		}

		.handle {
			display: none;
		}

		.pane-left[data-open='false'],
		.pane-right[data-open='false'] {
			display: none;
		}
	}
</style>
