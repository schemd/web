<script lang="ts">
	/**
	 * The schemd mark: one net routed as a lowercase s, a terminal at each end,
	 * its middle run yellow-lined the way a checker marks a traced net. Drawn
	 * with the page's own tokens, so it follows Day and Light table. The files
	 * in `static/brand` and the favicons are the same drawing in fixed colours.
	 */
	interface Props {
		size?: number;
	}

	let { size = 24 }: Props = $props();
</script>

<svg
	class="mark"
	viewBox="0 0 128 128"
	width={size}
	height={size}
	aria-hidden="true"
	focusable="false"
>
	<rect class="tile" x="5" y="5" width="118" height="118" rx="28" />
	<rect class="swipe" x="26" y="54" width="76" height="20" rx="5" transform="rotate(-3 64 64)" />
	<path class="net" d="M89.5 36H39V64H89V92H38.5" />
	<circle class="terminal" cx="97" cy="36" r="7.5" />
	<circle class="terminal" cx="31" cy="92" r="7.5" />
</svg>

<style>
	.mark {
		flex: none;
		display: block;
	}

	.tile {
		fill: var(--bg);
		stroke: var(--edge);
		stroke-width: 4;
	}

	.swipe {
		fill: var(--mark);
	}

	.net {
		fill: none;
		stroke: var(--ink);
		stroke-width: 12;
	}

	.terminal {
		fill: var(--bg);
		stroke: var(--ink);
		stroke-width: 6;
	}
</style>
