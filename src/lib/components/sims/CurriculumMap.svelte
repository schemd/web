<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t, href } = useLanguage();

	/**
	 * The curriculum, as a schematic you can walk.
	 *
	 * The drawing is compiled on the server (see curriculum-map.ts). Over each
	 * part sits a real link, so the map is reachable by keyboard and screen
	 * reader, not only by pointer; focusing or hovering one opens a card with
	 * the lab's objective. Labs completed on this device glow, and the next lab
	 * the curriculum recommends is marked.
	 */
	import { nodeElements, setNodeClass } from '#lib/sim-dom.ts';

	export interface MapLab {
		readonly id: string;
		readonly node: string;
		readonly index: string;
		readonly title: string;
		readonly tagline: string;
		readonly objective: string;
		readonly tier: string;
		readonly domain: string;
		readonly href: string;
		readonly done: boolean;
		readonly prerequisite?: string;
	}

	interface Props {
		svg: string;
		labs: readonly MapLab[];
		/** The lab the curriculum recommends next, if any. */
		next?: string;
	}

	let { svg, labs, next }: Props = $props();

	let host = $state<HTMLDivElement | undefined>();
	let layer = $state<HTMLDivElement | undefined>();
	let boxes = $state<Record<string, { x: number; y: number; w: number; h: number }>>({});
	let active = $state<string | null>(null);
	let frame = $state({ width: 0, height: 0 });
	const CARD_HALF = 156;
	const activeLab = $derived(labs.find((lab) => lab.id === active));

	function measure(): void {
		if (!host || !layer) return;
		const bounds = layer.getBoundingClientRect();
		frame = { width: bounds.width, height: bounds.height };
		const next: Record<string, { x: number; y: number; w: number; h: number }> = {};
		for (const lab of labs) {
			const rects = nodeElements(host, lab.node).map((node) => node.getBoundingClientRect());
			if (!rects.length) continue;
			const left = Math.min(...rects.map((rect) => rect.left));
			const top = Math.min(...rects.map((rect) => rect.top));
			const right = Math.max(...rects.map((rect) => rect.right));
			const bottom = Math.max(...rects.map((rect) => rect.bottom));
			next[lab.id] = {
				x: left - bounds.left - 6,
				y: top - bounds.top - 6,
				w: right - left + 12,
				h: bottom - top + 12
			};
		}
		boxes = next;
	}

	$effect(() => {
		if (!host || !layer) return;
		const observer = new ResizeObserver(() => measure());
		observer.observe(layer);
		measure();
		document.fonts?.ready.then(measure);
		return () => observer.disconnect();
	});

	$effect(() => {
		const root = host;
		if (!root) return;
		for (const lab of labs) {
			setNodeClass(root, lab.node, 'is-done', lab.done);
			setNodeClass(root, lab.node, 'is-next', lab.id === next);
			setNodeClass(root, lab.node, 'is-hot', lab.id === active);
		}
	});

	const tracks = [
		['digital', 'Digital'],
		['analog', 'Analog'],
		['quantum', 'Quantum']
	] as const;
</script>

<figure class="curriculum">
	<figcaption class="legend">
		<span class="microlabel">{t('Curriculum map')}</span>
		<ul>
			{#each tracks as [key, name] (key)}
				<li><i class="swatch {key}" aria-hidden="true"></i>{t(name)} {t('track')}</li>
			{/each}
			<li><i class="swatch done" aria-hidden="true"></i>{t('Completed here')}</li>
			{#if next}<li><i class="swatch next" aria-hidden="true"></i>{t('Recommended next')}</li>{/if}
		</ul>
	</figcaption>
	<div class="map-stage sheet-grid">
		<div class="map-drawing" bind:this={host} aria-hidden="true">
			{@html svg}
		</div>
		<div class="map-links" bind:this={layer}>
			{#each labs as lab (lab.id)}
				{@const box = boxes[lab.id]}
				{#if box}
					<a
						class="map-node"
						href={href(lab.href)}
						style={`left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px`}
						aria-label={t('Lab {0}: {1}.{2}{3}', [
							lab.index,
							lab.title,
							lab.done ? ' Completed on this device.' : '',
							lab.id === next ? ' Recommended next.' : ''
						])}
						onpointerenter={() => (active = lab.id)}
						onpointerleave={() => (active = active === lab.id ? null : active)}
						onfocus={() => (active = lab.id)}
						onblur={() => (active = active === lab.id ? null : active)}
					></a>
				{/if}
			{/each}
			{#if activeLab && boxes[activeLab.id]}
				{@const box = boxes[activeLab.id]!}
				{@const centre = Math.min(
					Math.max(box.x + box.w / 2, CARD_HALF),
					Math.max(CARD_HALF, frame.width - CARD_HALF)
				)}
				{@const below = box.y + box.h / 2 < frame.height / 2}
				<!-- Kept inside the map: clamped sideways, and opened upward for the lower tracks. -->
				<div
					class="card"
					class:above={!below}
					style={`left:${centre}px;top:${below ? box.y + box.h + 6 : box.y - 6}px`}
					role="presentation"
				>
					<span class="microlabel"
						>{t('Lab')} {t(activeLab.index)}, {t(activeLab.domain)}, {t(activeLab.tier)}</span
					>
					<strong>{t(activeLab.title)}</strong>
					<span>{t(activeLab.tagline)}</span>
					<span class="objective">{t(activeLab.objective)}</span>
					{#if activeLab.done}<span class="state done">{t('Completed on this device')}</span
						>{:else if activeLab.id === next}<span class="state next">{t('Recommended next')}</span
						>{/if}
				</div>
			{/if}
		</div>
	</div>
</figure>

<style>
	.curriculum {
		display: grid;
		gap: var(--space-3);
		margin: 0;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-5);

		& ul {
			display: flex;
			flex-wrap: wrap;
			gap: var(--space-2) var(--space-4);
			margin: 0;
			padding: 0;
			list-style: none;
			font: var(--text-xs) / 1.4 var(--font-sans);
			font-stretch: var(--width-table);
			font-variant-numeric: tabular-nums;
			color: var(--ink-mute);
		}

		& li {
			display: inline-flex;
			align-items: center;
			gap: 6px;
		}
	}

	.swatch {
		inline-size: 14px;
		block-size: 3px;
		border-radius: 1px;

		&.digital {
			background: var(--schematic-color-purple);
		}
		&.analog {
			background: var(--schematic-color-amber);
		}
		&.quantum {
			background: var(--schematic-color-cyan);
		}
		&.done {
			block-size: 8px;
			inline-size: 8px;
			border-radius: 50%;
			background: var(--accent);
			box-shadow: 0 0 6px var(--accent-glow);
		}
		&.next {
			block-size: 8px;
			inline-size: 8px;
			border-radius: 50%;
			border: 2px solid var(--accent);
		}
	}

	.map-stage {
		position: relative;
		padding: clamp(var(--space-2), 2vw, var(--space-5));
		border: 1px solid var(--line-strong);
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-inline: contain;
	}

	/* On a phone the map keeps a width whose parts are real tap targets, and
	   scrolls sideways; its links are what the keyboard reaches. */
	@media (max-width: 760px) {
		.map-drawing :global(svg) {
			min-inline-size: 720px;
		}
	}

	.map-drawing :global(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
	}

	.map-drawing :global(figcaption) {
		display: none;
	}

	/* Each label already carries its lab number; the L-designator would repeat it. */
	.map-drawing :global(.schematic-designator) {
		display: none;
	}

	.map-drawing :global([data-node-id]) {
		transition:
			filter var(--dur-med) var(--ease-precise),
			opacity var(--dur-med) var(--ease-precise);
	}

	.map-drawing :global([data-node-id].is-done) {
		filter: drop-shadow(0 0 6px var(--accent-glow));
	}

	.map-drawing :global([data-node-id].is-next) {
		animation: next-lab 1.8s var(--ease-precise) infinite;
	}

	.map-drawing :global([data-node-id].is-hot) {
		filter: drop-shadow(0 0 8px var(--accent));
	}

	@keyframes next-lab {
		50% {
			filter: drop-shadow(0 0 10px var(--accent));
		}
	}

	.map-links {
		position: absolute;
		inset: 0;
	}

	.map-node {
		position: absolute;
		border-radius: var(--radius-sm);
		outline-offset: 2px;

		&:hover,
		&:focus-visible {
			box-shadow: inset 0 0 0 1px var(--accent);
		}
	}

	.card {
		position: absolute;
		z-index: 2;
		display: grid;
		gap: 4px;
		inline-size: min(300px, 80vw);
		padding: var(--space-3);
		border: 1px solid var(--accent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--bg-raised) 96%, transparent);
		box-shadow: 0 12px 28px -14px rgb(0 0 0 / 0.7);
		transform: translateX(-50%);
		font-size: var(--text-sm);

		&.above {
			transform: translate(-50%, -100%);
		}
		color: var(--ink-mute);
		pointer-events: none;

		& strong {
			color: var(--ink);
			font-size: var(--text-md);
		}

		& .objective {
			color: var(--ink);
		}

		& .state {
			font: var(--text-xs) / 1.4 var(--font-sans);
			font-stretch: var(--width-table);
			font-variant-numeric: tabular-nums;
			color: var(--accent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.map-drawing :global([data-node-id].is-next) {
			animation: none;
			filter: drop-shadow(0 0 8px var(--accent));
		}
	}
</style>
