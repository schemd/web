<script lang="ts">
	interface IdeCommand {
		readonly id: string;
		readonly label: string;
		readonly detail: string;
		readonly shortcut?: string;
		readonly run: () => void | Promise<void>;
	}

	interface PaletteApi {
		readonly open: () => void;
	}

	let {
		commands,
		onready
	}: {
		commands: readonly IdeCommand[];
		onready?: (api: PaletteApi | undefined) => void;
	} = $props();

	let open = $state(false);
	let query = $state('');
	let active = $state(0);
	let input = $state<HTMLInputElement | undefined>();
	let dialog = $state<HTMLElement | undefined>();
	let restoreFocus: HTMLElement | undefined;

	const results = $derived.by(() => {
		const needle = query.trim().toLocaleLowerCase();
		if (needle === '') return commands;
		return commands
			.map((command) => {
				const label = command.label.toLocaleLowerCase();
				const detail = command.detail.toLocaleLowerCase();
				const labelIndex = label.indexOf(needle);
				const detailIndex = detail.indexOf(needle);
				const score =
					labelIndex >= 0 ? labelIndex : detailIndex >= 0 ? detailIndex + label.length : Infinity;
				return { command, score };
			})
			.filter(({ score }) => Number.isFinite(score))
			.sort((a, b) => a.score - b.score)
			.map(({ command }) => command);
	});

	$effect(() => {
		void results;
		active = 0;
	});

	$effect(() => {
		const command = results[active];
		if (!open || !command) return;
		queueMicrotask(() =>
			dialog
				?.querySelector<HTMLElement>(`#ide-command-${CSS.escape(command.id)}`)
				?.scrollIntoView({ block: 'nearest' })
		);
	});

	$effect(() => {
		onready?.({ open: show });
		return () => onready?.(undefined);
	});

	$effect(() => {
		if (!open) return;
		restoreFocus =
			document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
		const overflow = document.documentElement.style.overflow;
		document.documentElement.style.overflow = 'hidden';
		queueMicrotask(() => input?.focus());
		return () => {
			document.documentElement.style.overflow = overflow;
			restoreFocus?.focus();
			restoreFocus = undefined;
		};
	});

	function show(): void {
		query = '';
		open = true;
	}

	function close(): void {
		open = false;
	}

	async function run(command: IdeCommand): Promise<void> {
		close();
		await command.run();
	}

	function onWindowKeydown(event: KeyboardEvent): void {
		if (
			event.key === 'F1' ||
			((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLocaleLowerCase() === 'p')
		) {
			event.preventDefault();
			if (open) close();
			else show();
		} else if (event.key === 'Escape' && open) {
			event.preventDefault();
			close();
		}
	}

	function onInputKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (results.length === 0) return;
			const delta = event.key === 'ArrowDown' ? 1 : -1;
			active = (active + delta + results.length) % results.length;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const command = results[active];
			if (command) void run(command);
		}
	}

	function trapFocus(event: KeyboardEvent): void {
		if (event.key !== 'Tab') return;
		const focusable = dialog?.querySelectorAll<HTMLElement>(
			'input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
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
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if open}
	<div
		class="scrim"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) close();
		}}
	>
		<div
			bind:this={dialog}
			class="palette"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="ide-command-title"
			onkeydown={trapFocus}
		>
			<header>
				<div>
					<p id="ide-command-title" class="microlabel">playground commands</p>
					<input
						bind:this={input}
						bind:value={query}
						onkeydown={onInputKeydown}
						type="text"
						role="combobox"
						aria-label="Filter playground commands"
						aria-expanded="true"
						aria-controls="ide-command-results"
						aria-activedescendant={results[active]
							? `ide-command-${results[active]!.id}`
							: undefined}
						placeholder="Type a command…"
						autocomplete="off"
						spellcheck="false"
					/>
				</div>
				<button type="button" onclick={close} aria-label="Close playground commands">×</button>
			</header>

			<ul id="ide-command-results" role="listbox" aria-label="Playground commands">
				{#each results as command, index (command.id)}
					<li role="presentation">
						<button
							id={`ide-command-${command.id}`}
							type="button"
							role="option"
							aria-selected={index === active}
							onpointerenter={() => (active = index)}
							onclick={() => void run(command)}
						>
							<span>
								<strong>{command.label}</strong>
								<small>{command.detail}</small>
							</span>
							{#if command.shortcut}<kbd>{command.shortcut}</kbd>{/if}
						</button>
					</li>
				{:else}
					<li class="empty" role="option" aria-selected="false">No matching command.</li>
				{/each}
			</ul>
			<footer class="microlabel">
				<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
				<span><kbd>Enter</kbd> run</span>
				<span><kbd>Esc</kbd> close</span>
			</footer>
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 95;
		display: grid;
		place-items: start center;
		padding: 12vh var(--space-3) var(--space-3);
		background: color-mix(in srgb, var(--bg) 68%, transparent);
		backdrop-filter: blur(3px);
	}

	.palette {
		inline-size: min(42rem, calc(100vw - 2rem));
		max-block-size: min(74vh, 44rem);
		overflow: hidden;
		background: var(--bg-raised);
		border: 1px solid var(--line-strong);
		box-shadow: 0 22px 64px rgb(0 0 0 / 32%);
	}

	header {
		display: flex;
		align-items: start;
		gap: var(--space-3);
		padding: var(--space-3);
		border-block-end: 1px solid var(--line);

		& > div {
			flex: 1;
			min-inline-size: 0;
		}

		& p {
			margin: 0 0 var(--space-1);
			color: var(--ink-faint);
		}

		& input {
			inline-size: 100%;
			box-sizing: border-box;
			padding: 0.55rem 0;
			border: 0;
			outline: 0;
			background: none;
			color: var(--ink);
			font: inherit;
			font-size: var(--text-lg);
		}

		& button {
			padding: var(--space-1);
			color: var(--ink-faint);
			font-size: var(--text-lg);
		}
	}

	ul {
		max-block-size: 50vh;
		overflow-y: auto;
		margin: 0;
		padding: var(--space-1);
		list-style: none;

		& button {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: var(--space-4);
			inline-size: 100%;
			padding: var(--space-2) var(--space-3);
			text-align: start;
		}

		& button[aria-selected='true'] {
			background: var(--selection);
		}

		& button > span {
			display: grid;
			min-inline-size: 0;
		}

		& strong {
			font-weight: 620;
		}

		& small {
			color: var(--ink-faint);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		& kbd {
			flex: none;
		}
	}

	.empty {
		padding: var(--space-4);
		color: var(--ink-faint);
	}

	footer {
		display: flex;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		border-block-start: 1px solid var(--line);
		color: var(--ink-faint);

		& span {
			display: inline-flex;
			gap: 2px;
			align-items: center;
		}
	}

	@media (max-width: 560px) {
		.scrim {
			place-items: start stretch;
			padding: var(--space-2);
		}

		.palette {
			inline-size: 100%;
			max-block-size: calc(100dvh - 2 * var(--space-2));
		}

		ul {
			max-block-size: 65dvh;
		}

		footer {
			display: none;
		}
	}
</style>
