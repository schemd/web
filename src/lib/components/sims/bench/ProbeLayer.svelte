<script lang="ts">
	import { useLanguage } from '#lib/i18n/index.ts';
	const { t } = useLanguage();

	/**
	 * Probe clips on the drawing.
	 *
	 * Clicking any wire clips the next free channel onto its net (A, then B; a
	 * third click replaces B), and a flag at the clip reads the net live through
	 * server-authored KaTeX. Clicking a clipped net again unclips it. The same
	 * channels are chosen from the dock's selects, which is how a keyboard
	 * reaches them; both write the same two bindings.
	 */
	import { delegatedWireSource, wirePaths } from '#lib/sim-dom.ts';
	import LiveMath from '../LiveMath.svelte';
	import type { ProbeNet } from './types';

	interface Props {
		host: HTMLElement | undefined;
		nets: readonly ProbeNet[];
		a: string | null;
		b: string | null;
	}

	let { host, nets, a = $bindable(), b = $bindable() }: Props = $props();

	let layer = $state<HTMLDivElement | undefined>();
	let clicked = $state<Record<string, { x: number; y: number }>>({});
	let placed = $state<Record<string, { x: number; y: number }>>({});
	/* Only the clip just placed shows its reading, so flags never pile up over the drawing. */
	let open = $state<string | null>(null);

	const netFor = (source: string) => nets.find((net) => net.sources.includes(source));
	const byId = (id: string | null) => (id ? nets.find((net) => net.id === id) : undefined);

	/* A clip with no click yet (a default channel) sits on its net's first wire. */
	function place(): void {
		if (!host || !layer) return;
		const frame = layer.getBoundingClientRect();
		const next: Record<string, { x: number; y: number }> = {};
		for (const id of [a, b]) {
			const net = byId(id);
			if (!net) continue;
			const at = clicked[net.id];
			if (at) {
				next[net.id] = at;
				continue;
			}
			const path = net.sources.flatMap((source) => wirePaths(host!, source))[0];
			if (!path) continue;
			const box = path.getBoundingClientRect();
			next[net.id] = {
				x: box.left + box.width / 2 - frame.left,
				y: box.top + box.height / 2 - frame.top
			};
		}
		placed = next;
	}

	$effect(() => {
		void a;
		void b;
		void clicked;
		if (!host || !layer) return;
		const observer = new ResizeObserver(() => {
			clicked = {};
			place();
		});
		observer.observe(layer);
		place();
		return () => observer.disconnect();
	});

	$effect(() => {
		const root = host;
		if (!root) return;
		const onClick = (event: MouseEvent) => {
			if (!(event.target instanceof Element) || !layer) return;
			const source = delegatedWireSource(event.target);
			const net = source ? netFor(source) : undefined;
			if (!net) {
				open = null;
				return;
			}
			const frame = layer.getBoundingClientRect();
			if (a === net.id || b === net.id) {
				/* A second click on a clipped net reads it; a third unclips it. */
				if (open !== net.id) {
					open = net.id;
					return;
				}
				if (a === net.id) a = null;
				else b = null;
				open = null;
				return;
			}
			clicked = {
				...clicked,
				[net.id]: { x: event.clientX - frame.left, y: event.clientY - frame.top }
			};
			if (!a) a = net.id;
			else b = net.id;
			open = net.id;
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') open = null;
		};
		root.addEventListener('click', onClick);
		addEventListener('keydown', onKey);
		return () => {
			root.removeEventListener('click', onClick);
			removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="probe-layer" bind:this={layer} aria-live="polite">
	{#each [['A', a], ['B', b]] as [letter, id] (letter)}
		{@const net = byId(id)}
		{@const at = net ? placed[net.id] : undefined}
		{#if net && at}
			{@const reading = net.reading()}
			<div class="clip channel-{letter}" style={`left:${at.x}px;top:${at.y}px`}>
				<span class="jaw" aria-hidden="true">{t(letter)}</span>
				{#if open === net.id}
					<div
						class="probe-tip"
						role="note"
						aria-label={t('Probe {0} on {1}', [letter, net.label])}
					>
						<span class="microlabel">{t(letter)}, {t(net.label)}</span>
						{#if reading}
							<LiveMath id={reading.id} label={t(reading.label)} values={reading.values} />
						{:else}
							<span>{t(net.summary())}</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	.probe-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.clip {
		position: absolute;
		z-index: 3;
		transform: translate(-50%, -50%);
	}

	.jaw {
		display: grid;
		place-items: center;
		inline-size: 20px;
		block-size: 20px;
		border-radius: 50%;
		border: 2px solid var(--clip);
		background: var(--bg-panel);
		color: var(--clip);
		font: 600 0.625rem / 1 var(--font-sans);
		font-stretch: var(--width-table);
		font-variant-numeric: tabular-nums;
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--clip) 22%, transparent);
	}

	.channel-A {
		--clip: var(--accent);
	}
	.channel-B {
		--clip: var(--schematic-color-cyan);
	}

	.probe-tip {
		position: absolute;
		left: 14px;
		bottom: 16px;
		display: grid;
		gap: 2px;
		min-inline-size: max-content;
		padding: 6px 9px;
		border: 1px solid var(--clip);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--bg-raised) 94%, transparent);
		font-size: var(--text-sm);
		color: var(--ink);
		box-shadow: 0 8px 20px -12px rgb(0 0 0 / 0.6);

		& .microlabel {
			color: var(--clip);
		}
	}

	.channel-B .probe-tip {
		bottom: auto;
		top: 16px;
	}
</style>
