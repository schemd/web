<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();

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

	/** One ruled cell of the title block: the instrument's state, named. */
	export interface TitleBlockCell {
		readonly label: string;
		readonly value: string;
		readonly tone?: 'accent' | 'danger' | 'ok';
	}

	interface Props {
		left?: Snippet;
		center: Snippet;
		right?: Snippet;
		statusExtra?: Snippet;
		/** State shown as a drawing's title block along the foot of the shell. */
		titleBlock?: readonly TitleBlockCell[];
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
		titleBlock = [],
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
		/* Each pane is a sheet; the handles are the strips of table between them. */
		const leftCol = left ? (leftOpen ? `${leftWidth}px 12px` : '0px 12px') : '';
		const rightCol = right ? (rightOpen ? `12px ${rightWidth}px` : '12px 0px') : '';
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
		<section class="pane pane-left" aria-label={t(leftLabel)} data-open={leftOpen}>
			{@render left()}
		</section>
		<button
			type="button"
			class="handle"
			aria-label={t('Resize {0}. Arrow keys resize, Enter toggles.', [leftLabel])}
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
			aria-label={t('Resize {0}. Arrow keys resize, Enter toggles.', [rightLabel])}
			aria-pressed={rightOpen}
			onpointerdown={(event) => startDrag('right', event)}
			onkeydown={(event) => keyResize('right', event)}
		></button>
		<section class="pane pane-right" aria-label={t(rightLabel)} data-open={rightOpen}>
			{@render right()}
		</section>
	{/if}
</div>

<footer class="statusbar" aria-label={t('Status')}>
	{#if left}
		<button type="button" aria-pressed={leftOpen} onclick={() => (leftOpen = !leftOpen)}>
			{t(leftLabel)}
		</button>
	{/if}
	{#if right}
		<button type="button" aria-pressed={rightOpen} onclick={() => (rightOpen = !rightOpen)}>
			{t(rightLabel)}
		</button>
	{/if}
	{#if titleBlock.length > 0}
		<dl class="title-cells">
			{#each titleBlock as cell (cell.label)}
				<div data-tone={cell.tone}>
					<dt>{t(cell.label)}</dt>
					<dd>{t(cell.value)}</dd>
				</div>
			{/each}
		</dl>
	{/if}
	{#if statusExtra}
		<div class="status-extra">
			{@render statusExtra()}
		</div>
	{/if}
</footer>

<style>
	/* The panes lie on the table as three sheets, with the status strip as a
	   fourth along the bottom. */
	.workspace {
		display: grid;
		block-size: calc(100vh - var(--header-h) - var(--statusbar-h) - 24px);
		padding-inline: var(--space-3);
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
		border: 1px solid var(--edge);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sheet);
	}

	.pane-left,
	.pane-right {
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

		/* A 24 px control over the 12 px strip of table, with a grip in the
		   middle that darkens when it is used. */
		&::before {
			content: '';
			position: absolute;
			inset-block: calc(50% - 20px);
			inset-inline-start: calc(50% - 2px);
			inline-size: 4px;
			border-radius: 2px;
			background: var(--line-strong);
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

	/* The foot of the workspace: pane toggles, the state of the drawing as
	   label and value pairs, then the host's actions. */
	.statusbar {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		inline-size: calc(100% - 2 * var(--space-3));
		block-size: var(--statusbar-h);
		margin: var(--space-3) auto;
		padding-inline: var(--space-3) var(--space-4);
		background: var(--bg);
		border: 1px solid var(--edge);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sheet);
		font-size: var(--text-sm);

		& > button {
			padding: 0.2rem 0.6rem;
			border-radius: 6px;
			font-weight: 600;
			color: var(--ink-mute);

			&[aria-pressed='true'] {
				color: var(--ink);
				background: var(--wash);
				box-shadow: inset 0 0 0 1px var(--line);
			}

			&:hover {
				color: var(--ink);
			}
		}
	}

	/* Cells shrink and truncate rather than scroll: a scrolling strip would
	   need its own tab stop, and the full values are in the panes above. */
	.title-cells {
		display: flex;
		gap: var(--space-4);
		margin: 0;
		min-inline-size: 0;
		overflow: hidden;
		padding-inline-start: var(--space-4);
		border-inline-start: 1px solid var(--line);

		& div {
			display: flex;
			align-items: baseline;
			gap: var(--space-1);
			min-inline-size: 0;
			white-space: nowrap;
		}

		& dt {
			color: var(--ink-mute);
		}

		& dd {
			margin: 0;
			font-weight: 600;
			font-variant-numeric: tabular-nums;
			color: var(--ink);
			overflow: hidden;
			text-overflow: ellipsis;
		}

		& [data-tone='accent'] dd {
			color: var(--accent);
		}

		& [data-tone='danger'] dd {
			color: var(--danger);
		}

		& [data-tone='ok'] dd {
			color: var(--ink);
		}
	}

	/* The export, embed, and share actions live here. `overflow: hidden` hid
	   whichever ones did not fit — on a phone that silently removed sharing
	   from the product — so the strip scrolls instead, with the scrollbar
	   suppressed because the row is only one control tall. */
	.status-extra {
		margin-inline-start: auto;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-inline-size: 0;
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-inline: contain;
		scrollbar-width: none;

		/* The actions arrive through a snippet the host owns, so the scope has
		   to be released for the child selector to reach them. */
		& > :global(*) {
			flex: none;
		}
	}

	@media (max-width: 860px) {
		.workspace {
			display: flex;
			flex-direction: column;
			gap: var(--space-3);
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

		.pane {
			min-block-size: min(68vh, 640px);
		}

		.pane-left,
		.pane-right {
			min-block-size: min(50vh, 480px);
		}

		.statusbar {
			min-block-size: var(--statusbar-h);
			block-size: auto;
			flex-wrap: wrap;
			padding-block: var(--space-1);
		}

		/* A phone has the height to spare, so the cells wrap instead of being
		   cut short. */
		.title-cells {
			flex: 1 1 100%;
			flex-wrap: wrap;
			gap: var(--space-1) var(--space-4);
			padding-inline-start: 0;
			border-inline-start: 0;
		}

		.status-extra {
			flex: 1 1 100%;
			margin-inline-start: 0;
		}
	}
</style>
