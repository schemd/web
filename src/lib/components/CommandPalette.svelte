<script lang="ts">
	/**
	 * Universal command palette (Cmd+K / Ctrl+K).
	 *
	 * A fully keyboard-driven overlay: type to filter the platform search
	 * index, navigate with arrow keys, activate with Enter, dismiss with
	 * Escape. Focus is trapped inside the dialog while it is open.
	 */
	import { goto } from '$app/navigation';
	import { ui } from '$lib/ui.svelte';

	export interface PaletteEntry {
		readonly title: string;
		readonly hint: string;
		readonly href: string;
	}

	let { entries }: { entries: readonly PaletteEntry[] } = $props();

	let query = $state('');
	let activeIndex = $state(0);
	let input = $state<HTMLInputElement | undefined>();
	let listbox = $state<HTMLElement | undefined>();
	let dialog = $state<HTMLElement | undefined>();
	let restoreFocus: HTMLElement | undefined;

	const results = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		if (needle === '') return entries.slice(0, 12);
		return entries
			.map((entry) => {
				const haystack = `${entry.title} ${entry.hint}`.toLowerCase();
				const index = haystack.indexOf(needle);
				return { entry, score: index < 0 ? Number.POSITIVE_INFINITY : index };
			})
			.filter((scored) => Number.isFinite(scored.score))
			.sort((a, b) => a.score - b.score)
			.slice(0, 12)
			.map((scored) => scored.entry);
	});

	$effect(() => {
		void results;
		activeIndex = 0;
	});

	$effect(() => {
		if (ui.paletteOpen) {
			restoreFocus =
				document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
			query = '';
			queueMicrotask(() => input?.focus());
		} else if (restoreFocus) {
			restoreFocus.focus();
			restoreFocus = undefined;
		}
	});

	function trapFocus(event: KeyboardEvent): void {
		if (event.key !== 'Tab') return;
		const focusable = dialog?.querySelectorAll<HTMLElement>(
			'input:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
		);
		if (!focusable || focusable.length === 0) return;
		const first = focusable[0]!;
		const last = focusable[focusable.length - 1]!;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	function onWindowKeydown(event: KeyboardEvent): void {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			ui.paletteOpen = !ui.paletteOpen;
		} else if (event.key === 'Escape' && ui.paletteOpen) {
			ui.paletteOpen = false;
		}
	}

	function onInputKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = Math.min(activeIndex + 1, results.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = Math.max(activeIndex - 1, 0);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const target = results[activeIndex];
			if (target) activate(target);
		}
		listbox?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
	}

	function activate(entry: PaletteEntry): void {
		ui.paletteOpen = false;
		void goto(entry.href);
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if ui.paletteOpen}
	<div
		class="palette-scrim"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) ui.paletteOpen = false;
		}}
	>
		<div
			bind:this={dialog}
			class="palette panel"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="palette-title"
			onkeydown={trapFocus}
		>
			<div class="palette-head">
				<span id="palette-title" class="microlabel">⌘K · command palette</span>
				<input
					bind:this={input}
					bind:value={query}
					onkeydown={onInputKeydown}
					type="text"
					placeholder="Search documentation, playground, simulations…"
					role="combobox"
					aria-label="Search commands and documentation"
					aria-expanded="true"
					aria-controls="palette-results"
					aria-activedescendant={results.length > 0 ? `palette-option-${activeIndex}` : undefined}
					autocomplete="off"
					spellcheck="false"
				/>
				<button
					type="button"
					class="palette-close"
					onclick={() => (ui.paletteOpen = false)}
					aria-label="Close command palette">×</button
				>
			</div>
			<ul id="palette-results" role="listbox" bind:this={listbox} aria-label="Search results">
				{#each results as entry, index (entry.href)}
					<li role="presentation">
						<button
							id={`palette-option-${index}`}
							type="button"
							class="palette-option"
							role="option"
							aria-selected={index === activeIndex}
							data-index={index}
							tabindex="-1"
							onclick={() => activate(entry)}
							onpointerenter={() => (activeIndex = index)}
						>
							<span class="entry-title">{entry.title}</span>
							<span class="entry-hint">{entry.hint}</span>
						</button>
					</li>
				{:else}
					<li class="palette-empty" role="option" aria-selected="false">
						No matches. Try “ports”.
					</li>
				{/each}
			</ul>
			<footer class="palette-foot microlabel">
				<span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
				<span><kbd>Enter</kbd> open</span>
				<span><kbd>Esc</kbd> dismiss</span>
			</footer>
		</div>
	</div>
{/if}

<style>
	.palette-scrim {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: color-mix(in srgb, var(--bg) 62%, transparent);
		backdrop-filter: blur(3px);
		display: grid;
		place-items: start center;
		padding-block-start: 14vh;
		animation: crossfade var(--dur-fast) var(--ease-precise) both;
	}

	.palette {
		inline-size: min(620px, calc(100vw - 2rem));
		animation: sweep-in var(--dur-fast) var(--ease-precise) both;
	}

	.palette-head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-block-end: 1px solid var(--line);

		& input {
			flex: 1;
			background: none;
			border: none;
			color: var(--ink);
			font: inherit;
			font-size: var(--text-md);

			&:focus {
				outline: none;
			}
		}
	}

	ul {
		list-style: none;
		margin: 0;
		padding: var(--space-1);
		max-block-size: 46vh;
		overflow-y: auto;
	}

	.palette-option {
		display: flex;
		inline-size: 100%;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
		padding: 0.55rem var(--space-3);
		text-align: start;
	}

	.palette-option[aria-selected='true'] {
		background: var(--selection);

		& .entry-hint {
			color: var(--ink);
		}
	}

	.entry-title {
		font-weight: 580;
	}

	.entry-hint {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-faint);
		white-space: nowrap;
	}

	.palette-empty {
		padding: var(--space-4);
		color: var(--ink-faint);
	}

	.palette-foot {
		display: flex;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		border-block-start: 1px solid var(--line);
	}
</style>
