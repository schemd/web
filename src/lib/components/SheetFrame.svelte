<script lang="ts">
	/**
	 * A drawing sheet: zone rulers on all four sides around ruled paper.
	 *
	 * Columns are numbered and rows lettered, the way a plotted sheet is, so
	 * any place on it has a reference — "C4" — that prose and links can use.
	 * The rulers are decoration to assistive technology; the content inside
	 * carries its own headings.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		columns?: number;
		rows?: number;
		/** Draw the slow scan line that crosses the sheet top to bottom. */
		scan?: boolean;
		label?: string;
		children: Snippet;
	}

	let { columns = 8, rows = 6, scan = false, label, children }: Props = $props();

	const cols = $derived(Array.from({ length: columns }, (_, index) => String(index + 1)));
	const rowLetters = $derived(
		Array.from({ length: rows }, (_, index) => String.fromCharCode(65 + index))
	);
</script>

<section class="sheet" aria-label={label} style={`--cols: ${columns}; --rows: ${rows}`}>
	<span class="corner" aria-hidden="true"></span>
	<div class="ruler x top" aria-hidden="true">
		{#each cols as col (col)}<span>{col}</span>{/each}
	</div>
	<span class="corner" aria-hidden="true"></span>

	<div class="ruler y left" aria-hidden="true">
		{#each rowLetters as row (row)}<span>{row}</span>{/each}
	</div>
	<div class="body sheet-grid">
		{@render children()}
	</div>
	<div class="ruler y right" aria-hidden="true">
		{#each rowLetters as row (row)}<span>{row}</span>{/each}
	</div>

	<span class="corner" aria-hidden="true"></span>
	<div class="ruler x bottom" aria-hidden="true">
		{#each cols as col (col)}<span>{col}</span>{/each}
	</div>
	<span class="corner" aria-hidden="true"></span>

	{#if scan}<span class="scan" aria-hidden="true"></span>{/if}
</section>

<style>
	.sheet {
		--gutter: 26px;
		position: relative;
		display: grid;
		grid-template-columns: var(--gutter) minmax(0, 1fr) var(--gutter);
		grid-template-rows: var(--gutter) auto var(--gutter);
		border: 1px solid var(--line-strong);
		background: var(--bg-panel);
	}

	.corner {
		border-color: var(--line-strong);
	}

	.ruler {
		display: grid;
		font-family: var(--font-label);
		font-size: 0.625rem;
		color: var(--ink-faint);
		user-select: none;

		& span {
			display: flex;
			align-items: center;
			justify-content: center;
			border-color: var(--line-strong);
		}
	}

	.x {
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));

		& span + span {
			border-inline-start: 1px solid var(--line-strong);
		}
	}

	.y {
		grid-template-rows: repeat(var(--rows), minmax(0, 1fr));

		& span + span {
			border-block-start: 1px solid var(--line-strong);
		}
	}

	.top {
		border-block-end: 1px solid var(--line-strong);
	}

	.bottom {
		border-block-start: 1px solid var(--line-strong);
	}

	.left {
		border-inline-end: 1px solid var(--line-strong);
	}

	.right {
		border-inline-start: 1px solid var(--line-strong);
	}

	.body {
		min-inline-size: 0;
	}

	.scan {
		position: absolute;
		inset-inline: var(--gutter);
		inset-block-start: var(--gutter);
		block-size: 1px;
		background: linear-gradient(90deg, transparent, var(--accent), transparent);
		opacity: 0.45;
		pointer-events: none;
		animation: sheet-scan 9s linear infinite;
	}

	/* Top to bottom of the ruled area, whatever its height. */
	@keyframes sheet-scan {
		from {
			inset-block-start: var(--gutter);
		}
		to {
			inset-block-start: calc(100% - var(--gutter) - 1px);
		}
	}

	@media (max-width: 720px) {
		.sheet {
			--gutter: 16px;
		}

		.ruler {
			font-size: 0.5rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.scan {
			display: none;
		}
	}
</style>
