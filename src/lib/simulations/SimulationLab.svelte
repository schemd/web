<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SchematicCompilationMetrics } from '@schemd/core';
	import { NativeAudioBridge, SIMULATION_AUDIO_EVENT, dispatchSimulationAudio } from './audio';
	import {
		FAULT_MODES,
		faultLabel,
		oscilloscopePath,
		type FaultMode,
		type ProbeMetric,
		type ProbeTarget,
		type WaveformKind
	} from './instrumentation';
	import type { PublicSimulationDefinition, SimulationVersion } from './manifest';

	type LabTheme = 'dark' | 'blueprint' | 'light';

	interface Props {
		version: SimulationVersion;
		definition: PublicSimulationDefinition;
		svg: string;
		compileMetrics: SchematicCompilationMetrics;
		waveform: WaveformKind;
		traceRate?: number;
		metrics: readonly ProbeMetric[];
		fault?: FaultMode;
		children: Snippet;
	}

	let {
		version,
		definition,
		svg,
		compileMetrics,
		waveform,
		traceRate = 1,
		metrics,
		fault = $bindable<FaultMode>('none'),
		children
	}: Props = $props();

	let labRoot: HTMLElement | undefined = $state();
	let schematicHost: HTMLElement | undefined = $state();
	let theme: LabTheme = $state('dark');
	let probeArmed = $state(false);
	let selectedTarget: ProbeTarget | undefined = $state();
	let selectedElement: Element | undefined;
	let hudX = $state(0);
	let hudY = $state(0);
	let hudVisible = $state(false);
	let phase = $state(0);
	let reducedMotion = $state(false);
	let audioEnabled = $state(false);
	let pointerFrame = 0;
	let pendingPointer: { x: number; y: number } | undefined;
	const audioBridge = new NativeAudioBridge();

	const scopePath = $derived(oscilloscopePath(waveform, phase, 320, 136, 72));
	const selectedLabel = $derived(selectedTarget?.label ?? 'No target selected');
	const traceStatus = $derived(
		reducedMotion ? 'Static · reduced motion' : 'Live · requestAnimationFrame'
	);

	function semanticTarget(origin: Element): { element: Element; target: ProbeTarget } | undefined {
		const element = origin.closest('[data-port-id], [data-node-id], [data-wire-source]');
		if (!element || !schematicHost?.contains(element)) return;

		if (element.hasAttribute('data-port-id')) {
			const parent = element.getAttribute('data-parent-node') ?? 'node';
			const port = element.getAttribute('data-port-id') ?? 'port';
			return {
				element,
				target: { kind: 'port', id: `${parent}.${port}`, label: `${parent} · ${port} port` }
			};
		}

		if (element.hasAttribute('data-wire-source')) {
			const source = element.getAttribute('data-wire-source') ?? 'source';
			const target = element.getAttribute('data-wire-target') ?? 'target';
			return {
				element,
				target: { kind: 'wire', id: `${source}→${target}`, label: `${source} → ${target}` }
			};
		}

		const id = element.getAttribute('data-node-id') ?? 'node';
		const label = element.getAttribute('data-node-label') ?? id;
		const kind = element.getAttribute('data-node-kind') ?? 'component';
		return { element, target: { kind: 'node', id, label: `${label} · ${kind}` } };
	}

	function selectSemanticTarget(origin: Element): void {
		const selection = semanticTarget(origin);
		if (!selection) return;
		selectedElement?.classList.remove('is-selected');
		selectedElement = selection.element;
		selectedElement.classList.add('is-selected');
		selectedTarget = selection.target;
		dispatchSimulationAudio(selection.element, {
			frequency: selection.target.kind === 'wire' ? 520 : 660,
			duration: 0.045,
			gain: 0.014,
			source: `probe:${selection.target.id}`
		});
	}

	function handleSchematicClick(event: MouseEvent): void {
		if (!(event.target instanceof Element)) return;
		selectSemanticTarget(event.target);
	}

	function handleSchematicKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		if (!(event.target instanceof Element)) return;
		const selection = semanticTarget(event.target);
		if (!selection) return;
		event.preventDefault();
		selectSemanticTarget(selection.element);
	}

	function queuePointer(event: PointerEvent): void {
		if (!probeArmed) return;
		const coalesced =
			typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
		const sample = coalesced[coalesced.length - 1] ?? event;
		pendingPointer = { x: sample.clientX, y: sample.clientY };
		hudVisible = true;
		if (pointerFrame !== 0) return;
		pointerFrame = requestAnimationFrame(() => {
			pointerFrame = 0;
			const pointer = pendingPointer;
			if (!pointer) return;
			const hudWidth = 230;
			const hudHeight = 138;
			const maximumX = Math.max(12, window.innerWidth - hudWidth - 12);
			const maximumY = Math.max(12, window.innerHeight - hudHeight - 12);
			hudX = Math.min(maximumX, Math.max(12, pointer.x + 18));
			hudY = Math.min(maximumY, Math.max(12, pointer.y + 18));
		});
	}

	function setFault(nextFault: FaultMode, event: MouseEvent): void {
		fault = nextFault;
		dispatchSimulationAudio(event.currentTarget, {
			frequency: nextFault === 'none' ? 720 : 180,
			duration: nextFault === 'none' ? 0.08 : 0.13,
			gain: 0.022,
			wave: nextFault === 'none' ? 'sine' : 'sawtooth',
			source: `fault:${nextFault}`
		});
	}

	function toggleAudio(event: MouseEvent): void {
		audioEnabled = !audioEnabled;
		localStorage.setItem('schemd:audio', String(audioEnabled));
		window.dispatchEvent(new CustomEvent('schemd:audio-toggle', { detail: audioEnabled }));
		dispatchSimulationAudio(event.currentTarget, {
			frequency: audioEnabled ? 880 : 330,
			duration: 0.08,
			source: `audio:${audioEnabled ? 'enabled' : 'disabled'}`
		});
	}

	$effect(() => {
		audioEnabled = localStorage.getItem('schemd:audio') === 'true';
		const synchronizeAudio = (event: Event): void => {
			if (event instanceof CustomEvent && typeof event.detail === 'boolean') {
				audioEnabled = event.detail;
			}
		};
		window.addEventListener('schemd:audio-toggle', synchronizeAudio);
		return () => window.removeEventListener('schemd:audio-toggle', synchronizeAudio);
	});

	$effect(() => {
		const root = labRoot;
		if (!root) return;
		const handleAudio = (event: Event): void => {
			if (!(event instanceof CustomEvent) || !audioEnabled) return;
			const cue = event.detail;
			if (!cue || typeof cue !== 'object') return;
			queueMicrotask(() => {
				if (!event.defaultPrevented) void audioBridge.play(cue);
			});
		};
		root.addEventListener(SIMULATION_AUDIO_EVENT, handleAudio);
		return () => root.removeEventListener(SIMULATION_AUDIO_EVENT, handleAudio);
	});

	$effect(() => {
		if (typeof document === 'undefined') return;
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		let frame = 0;
		let previous = performance.now();

		const tick = (now: number): void => {
			const elapsed = Math.min(0.05, Math.max(0, (now - previous) / 1000));
			previous = now;
			phase =
				(phase + elapsed * Math.PI * 2 * Math.min(4, Math.max(0.08, traceRate))) % (Math.PI * 2);
			frame = requestAnimationFrame(tick);
		};

		const stop = (): void => {
			if (frame !== 0) cancelAnimationFrame(frame);
			frame = 0;
		};

		const synchronize = (): void => {
			reducedMotion = media.matches;
			stop();
			if (reducedMotion) {
				phase = 0;
				return;
			}
			if (document.visibilityState !== 'visible') return;
			previous = performance.now();
			frame = requestAnimationFrame(tick);
		};

		media.addEventListener('change', synchronize);
		document.addEventListener('visibilitychange', synchronize);
		synchronize();

		return () => {
			stop();
			media.removeEventListener('change', synchronize);
			document.removeEventListener('visibilitychange', synchronize);
		};
	});

	$effect(() => {
		return () => {
			if (pointerFrame !== 0) cancelAnimationFrame(pointerFrame);
			selectedElement?.classList.remove('is-selected');
			audioBridge.close();
		};
	});
</script>

<article
	class="simulation-lab"
	data-theme={theme}
	data-fault={fault}
	data-simulation-id={definition.id}
	bind:this={labRoot}
>
	<header class="topbar">
		<div class="crumbs" aria-label="Breadcrumb">
			<a href="/">schemd</a>
			<span aria-hidden="true">/</span>
			<a href={`/simulations/${version.id}`}>simulations</a>
			<span aria-hidden="true">/</span>
			<strong>{definition.id}</strong>
		</div>
		<div class="top-actions">
			<label class="theme-control">
				<span>Surface</span>
				<select bind:value={theme} aria-label="Simulation color theme">
					<option value="dark">Dark lab</option>
					<option value="blueprint">Blueprint</option>
					<option value="light">Light bench</option>
				</select>
			</label>
			<button
				class:active={audioEnabled}
				class="icon-button"
				type="button"
				aria-pressed={audioEnabled}
				onclick={toggleAudio}
			>
				<span class="status-dot" aria-hidden="true"></span>
				Audio {audioEnabled ? 'on' : 'off'}
			</button>
		</div>
	</header>

	<section class="hero">
		<div>
			<p class="eyebrow">{definition.domain} · {version.label}</p>
			<h1>{definition.title}</h1>
			<p class="summary">{definition.summary}</p>
		</div>
		<div class="compiler-readout" aria-label="Server compilation statistics">
			<span>SSR vector</span>
			<strong>{compileMetrics.components} nodes · {compileMetrics.connections} nets</strong>
			<small>{(compileMetrics.svgBytes / 1024).toFixed(1)} kB deterministic SVG</small>
		</div>
	</section>

	<div class="workbench">
		<aside class="control-rail" aria-label={`${definition.title} controls`}>
			<div class="rail-heading">
				<div>
					<p class="section-kicker">Input matrix</p>
					<h2>Controls</h2>
				</div>
				<span class="live-pill">Reactive</span>
			</div>

			<div class="control-content">
				{@render children()}
			</div>

			<section class="fault-panel" aria-labelledby="fault-heading">
				<div class="section-row">
					<div>
						<p class="section-kicker">Failure analysis</p>
						<h3 id="fault-heading">Fault switchboard</h3>
					</div>
					<span class:danger={fault !== 'none'}>{fault === 'none' ? 'CLEAR' : 'ARMED'}</span>
				</div>
				<div class="fault-grid">
					{#each FAULT_MODES as mode}
						<button
							id={`fault-${definition.id}-${mode}`}
							type="button"
							class:active={fault === mode}
							aria-pressed={fault === mode}
							onclick={(event) => setFault(mode, event)}
						>
							<span class="fault-led" aria-hidden="true"></span>
							{faultLabel(mode)}
						</button>
					{/each}
				</div>
			</section>

			<div class="concept-card">
				<p class="section-kicker">Core idea</p>
				<p>{definition.idea}</p>
				<a href={definition.docsPath}
					>Read the component contract <span aria-hidden="true">↗</span></a
				>
			</div>
		</aside>

		<section class="board" aria-label={`${definition.title} live schematic`}>
			<div class="board-toolbar">
				<div class="board-title">
					<span class="board-index">01</span>
					<div>
						<strong>Instrumented schematic</strong>
						<small>{selectedLabel}</small>
					</div>
				</div>
				<div class="probe-actions">
					<span class:warning={fault !== 'none'} class="fault-status">
						{fault === 'none' ? 'Nominal topology' : faultLabel(fault)}
					</span>
					<button
						type="button"
						class:active={probeArmed}
						aria-pressed={probeArmed}
						onclick={() => {
							probeArmed = !probeArmed;
							hudVisible = false;
						}}
					>
						<span aria-hidden="true">⌖</span>
						{probeArmed ? 'Probe armed' : 'Arm probe'}
					</button>
				</div>
			</div>

			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="schematic-host"
				class:probe-armed={probeArmed}
				bind:this={schematicHost}
				role="group"
				aria-label="Interactive compiled SVG. Focus or click a node, port, or wire to inspect it."
				onclick={handleSchematicClick}
				onkeydown={handleSchematicKeydown}
				onpointermove={queuePointer}
				onpointerleave={() => (hudVisible = false)}
			>
				{@html svg}
			</div>

			<div class="diagnostic-deck">
				<section class="scope" aria-label="Live oscilloscope">
					<div class="instrument-header">
						<div>
							<p class="section-kicker">Channel A · {waveform}</p>
							<strong>Vector scope</strong>
						</div>
						<span>{traceStatus}</span>
					</div>
					<svg viewBox="0 0 320 136" role="img" aria-label={`${waveform} diagnostic waveform`}>
						<defs>
							<pattern
								id={`scope-grid-${definition.id}`}
								width="32"
								height="27.2"
								patternUnits="userSpaceOnUse"
							>
								<path d="M 32 0 L 0 0 0 27.2" />
							</pattern>
							<filter
								id={`scope-glow-${definition.id}`}
								x="-20%"
								y="-30%"
								width="140%"
								height="160%"
							>
								<feGaussianBlur stdDeviation="2.2" result="blur" />
								<feMerge>
									<feMergeNode in="blur" />
									<feMergeNode in="SourceGraphic" />
								</feMerge>
							</filter>
						</defs>
						<rect
							width="320"
							height="136"
							class="scope-grid"
							fill={`url(#scope-grid-${definition.id})`}
						/>
						<path d={scopePath} class="scope-trace" filter={`url(#scope-glow-${definition.id})`} />
					</svg>
				</section>

				<section class="meter" aria-labelledby="meter-heading">
					<div class="instrument-header">
						<div>
							<p class="section-kicker">Selected telemetry</p>
							<strong id="meter-heading">Multimeter</strong>
						</div>
						<span>AUTO</span>
					</div>
					<div class="metric-grid" aria-live="polite">
						{#each metrics as metric}
							<div
								class:warning={metric.tone === 'warning'}
								class:danger={metric.tone === 'danger'}
							>
								<span>{metric.label}</span>
								<strong>{metric.value}</strong>
							</div>
						{/each}
					</div>
				</section>
			</div>
		</section>
	</div>

	<p class="sr-only" aria-live="polite">
		{selectedTarget
			? `Probe selected ${selectedTarget.kind} ${selectedTarget.label}.`
			: 'Probe has no selection.'}
		Current fault state: {faultLabel(fault)}.
	</p>

	{#if probeArmed && hudVisible}
		<div class="probe-hud" style={`--hud-x:${hudX}px;--hud-y:${hudY}px`} aria-hidden="true">
			<div class="hud-header">
				<span>⌖ FLOATING DMM</span>
				<i></i>
			</div>
			<strong>{selectedTarget?.id ?? 'Select semantic target'}</strong>
			{#each metrics.slice(0, 2) as metric}
				<div><span>{metric.label}</span><b>{metric.value}</b></div>
			{/each}
		</div>
	{/if}
</article>

<style>
	.simulation-lab {
		--bg: #070b0e;
		--panel: #0b1216;
		--panel-raised: #10191e;
		--surface: #0a1014;
		--line: #243139;
		--line-strong: #354650;
		--text: #eaf4ef;
		--muted: #84958e;
		--signal: #77e1bc;
		--signal-rgb: 119, 225, 188;
		--blue: #6da7ff;
		--amber: #e7a75d;
		--danger: #ff7176;
		--grid: rgba(119, 225, 188, 0.055);
		min-height: 100dvh;
		padding: 0 clamp(16px, 3vw, 44px) 48px;
		overflow-x: clip;
		background:
			linear-gradient(var(--grid) 1px, transparent 1px),
			linear-gradient(90deg, var(--grid) 1px, transparent 1px),
			radial-gradient(circle at 80% 0%, rgba(var(--signal-rgb), 0.07), transparent 32%), var(--bg);
		background-size:
			32px 32px,
			32px 32px,
			auto,
			auto;
		color: var(--text);
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	.simulation-lab[data-theme='blueprint'] {
		--bg: #061827;
		--panel: #092238;
		--panel-raised: #0b2b46;
		--surface: #061d30;
		--line: #235172;
		--line-strong: #38779f;
		--text: #e7f5ff;
		--muted: #8db3cc;
		--signal: #7fcbff;
		--signal-rgb: 127, 203, 255;
		--blue: #8ab7ff;
		--amber: #ffd174;
		--danger: #ff858a;
		--grid: rgba(127, 203, 255, 0.08);
	}

	.simulation-lab[data-theme='light'] {
		--bg: #edf2ef;
		--panel: #f8fbf9;
		--panel-raised: #ffffff;
		--surface: #f6faf7;
		--line: #c8d4ce;
		--line-strong: #a6b8af;
		--text: #14221c;
		--muted: #62736b;
		--signal: #087c5d;
		--signal-rgb: 8, 124, 93;
		--blue: #2769c5;
		--amber: #9b5b0c;
		--danger: #c7323b;
		--grid: rgba(20, 34, 28, 0.045);
	}

	.topbar,
	.hero,
	.workbench {
		width: min(1520px, 100%);
		margin-inline: auto;
	}

	.topbar {
		min-height: 66px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		border-bottom: 1px solid var(--line);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 11px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.crumbs,
	.top-actions,
	.probe-actions,
	.board-title,
	.section-row,
	.rail-heading,
	.instrument-header {
		display: flex;
		align-items: center;
	}

	.crumbs {
		gap: 9px;
		color: var(--muted);
	}

	.crumbs a,
	.concept-card a {
		color: var(--signal);
		text-decoration: none;
	}

	.crumbs strong {
		color: var(--text);
	}

	.top-actions {
		gap: 9px;
	}

	.theme-control,
	.icon-button,
	.probe-actions button {
		min-height: 36px;
		border: 1px solid var(--line);
		border-radius: 7px;
		background: var(--panel);
		color: var(--text);
	}

	.theme-control {
		display: flex;
		align-items: center;
		padding-left: 12px;
		color: var(--muted);
	}

	.theme-control select {
		height: 34px;
		padding: 0 26px 0 8px;
		border: 0;
		background: transparent;
		color: var(--text);
		font: inherit;
		text-transform: uppercase;
	}

	.icon-button,
	.probe-actions button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding-inline: 12px;
		font: inherit;
		text-transform: uppercase;
		cursor: pointer;
	}

	.icon-button.active,
	.probe-actions button.active {
		border-color: rgba(var(--signal-rgb), 0.5);
		background: rgba(var(--signal-rgb), 0.1);
	}

	.status-dot,
	.fault-led {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: var(--muted);
		box-shadow: 0 0 0 3px rgba(var(--signal-rgb), 0.05);
	}

	.icon-button.active .status-dot {
		background: var(--signal);
		box-shadow: 0 0 11px var(--signal);
	}

	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 36px;
		padding-block: clamp(34px, 5vw, 68px) clamp(26px, 4vw, 45px);
	}

	.eyebrow,
	.section-kicker {
		margin: 0 0 9px;
		color: var(--signal);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}

	h1 {
		max-width: 900px;
		margin-bottom: 14px;
		font-size: clamp(2.2rem, 5.6vw, 5.8rem);
		font-weight: 530;
		letter-spacing: -0.065em;
		line-height: 0.94;
	}

	.summary {
		max-width: 720px;
		margin-bottom: 0;
		color: var(--muted);
		font-size: clamp(0.98rem, 1.4vw, 1.15rem);
		line-height: 1.65;
	}

	.compiler-readout {
		min-width: 230px;
		padding: 16px 18px;
		border: 1px solid var(--line);
		border-left: 2px solid var(--signal);
		background: var(--panel);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	.compiler-readout span,
	.compiler-readout small {
		display: block;
		color: var(--muted);
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.compiler-readout strong {
		display: block;
		margin: 8px 0 5px;
		font-size: 12px;
	}

	.workbench {
		display: grid;
		grid-template-columns: minmax(270px, 330px) minmax(0, 1fr);
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--panel);
		box-shadow: 0 26px 70px rgba(0, 0, 0, 0.18);
		overflow: hidden;
	}

	.control-rail {
		padding: 22px;
		border-right: 1px solid var(--line);
		background:
			linear-gradient(150deg, rgba(var(--signal-rgb), 0.035), transparent 38%), var(--panel);
	}

	.rail-heading,
	.section-row,
	.instrument-header {
		justify-content: space-between;
		gap: 15px;
	}

	h2,
	h3 {
		margin-bottom: 0;
		font-size: 14px;
		letter-spacing: -0.01em;
	}

	.live-pill,
	.section-row > span {
		padding: 5px 7px;
		border: 1px solid rgba(var(--signal-rgb), 0.35);
		border-radius: 999px;
		color: var(--signal);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.1em;
	}

	.control-content {
		padding-block: 25px;
		border-bottom: 1px solid var(--line);
	}

	.fault-panel {
		padding-block: 24px;
		border-bottom: 1px solid var(--line);
	}

	.section-row > span.danger,
	.danger {
		color: var(--danger);
		border-color: color-mix(in srgb, var(--danger) 40%, transparent);
	}

	.fault-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 7px;
		margin-top: 15px;
	}

	.fault-grid button {
		min-height: 48px;
		padding: 9px;
		display: flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--surface);
		color: var(--muted);
		font:
			600 9px/1.25 ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		text-align: left;
		text-transform: uppercase;
		cursor: pointer;
	}

	.fault-grid button:hover,
	.fault-grid button.active {
		border-color: var(--line-strong);
		color: var(--text);
		background: var(--panel-raised);
	}

	.fault-grid button.active:not(:first-child) {
		border-color: color-mix(in srgb, var(--danger) 48%, var(--line));
		color: var(--danger);
	}

	.fault-grid button.active:not(:first-child) .fault-led {
		background: var(--danger);
		box-shadow: 0 0 10px var(--danger);
	}

	.fault-grid button:first-child.active .fault-led {
		background: var(--signal);
		box-shadow: 0 0 9px var(--signal);
	}

	.concept-card {
		margin-top: 22px;
		padding: 15px;
		border: 1px solid var(--line);
		border-radius: 7px;
		background: var(--surface);
	}

	.concept-card p:not(.section-kicker) {
		margin-bottom: 14px;
		color: var(--muted);
		font-size: 12px;
		line-height: 1.55;
	}

	.concept-card a {
		font:
			700 9px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.board {
		min-width: 0;
		background: var(--surface);
	}

	.board-toolbar {
		min-height: 70px;
		padding: 12px 17px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		border-bottom: 1px solid var(--line);
		background: var(--panel);
	}

	.board-title {
		gap: 11px;
		min-width: 0;
	}

	.board-index {
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: 5px;
		color: var(--signal);
		font:
			700 10px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
	}

	.board-title strong,
	.board-title small {
		display: block;
	}

	.board-title strong {
		font-size: 12px;
	}

	.board-title small {
		max-width: 42ch;
		margin-top: 4px;
		overflow: hidden;
		color: var(--muted);
		font:
			9px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.probe-actions {
		gap: 9px;
	}

	.fault-status {
		color: var(--signal);
		font:
			700 9px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.fault-status.warning {
		color: var(--danger);
	}

	.schematic-host {
		--schematic-surface: var(--surface);
		--schematic-vector-fallback: var(--text);
		--schematic-grid: var(--muted);
		--schematic-stroke-width: 1.55;
		--schematic-interactive-stroke-width: 2.35;
		min-height: 430px;
		display: grid;
		place-items: center;
		padding: clamp(18px, 3vw, 42px);
		border-bottom: 1px solid var(--line);
		background:
			radial-gradient(circle at center, rgba(var(--signal-rgb), 0.045), transparent 46%),
			var(--surface);
		overflow: auto;
	}

	.schematic-host.probe-armed {
		cursor: crosshair;
	}

	.schematic-host :global(.schematic-frame) {
		width: min(100%, 1120px);
		margin: 0;
	}

	.schematic-host :global(.schematic-frame > svg) {
		width: 100%;
		height: auto;
		display: block;
		color: var(--text);
	}

	.schematic-host :global(.schematic-component),
	.schematic-host :global(.schematic-wire),
	.schematic-host :global(.schematic-port-hotspot) {
		cursor: pointer;
	}

	.simulation-lab[data-fault='short-ground'] .schematic-host :global(.schematic-wire) {
		--schematic-vector: var(--danger);
		filter: drop-shadow(0 0 3px color-mix(in srgb, var(--danger) 55%, transparent));
	}

	.simulation-lab[data-fault='open-circuit']
		.schematic-host
		:global(.schematic-wire:nth-of-type(even)) {
		opacity: 0.18;
		stroke-dasharray: 4 9;
	}

	.simulation-lab[data-fault='degraded-resistor']
		.schematic-host
		:global([data-node-kind='resistor']) {
		opacity: 0.34;
		filter: saturate(0.2);
	}

	.diagnostic-deck {
		display: grid;
		grid-template-columns: minmax(290px, 1.15fr) minmax(260px, 0.85fr);
		min-height: 212px;
	}

	.scope,
	.meter {
		min-width: 0;
		padding: 17px;
		background: var(--panel);
	}

	.scope {
		border-right: 1px solid var(--line);
	}

	.instrument-header {
		margin-bottom: 12px;
	}

	.instrument-header strong,
	.instrument-header span {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	.instrument-header strong {
		font-size: 11px;
		text-transform: uppercase;
	}

	.instrument-header span {
		color: var(--signal);
		font-size: 8px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.scope svg {
		width: 100%;
		height: 136px;
		display: block;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: #040806;
	}

	.scope svg :global(pattern path) {
		fill: none;
		stroke: rgba(119, 225, 188, 0.13);
		stroke-width: 0.6;
	}

	.scope-trace {
		fill: none;
		stroke: #77e1bc;
		stroke-width: 1.8;
		vector-effect: non-scaling-stroke;
	}

	.metric-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.metric-grid > div {
		min-width: 0;
		min-height: 58px;
		padding: 10px;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: var(--surface);
	}

	.metric-grid span,
	.metric-grid strong {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.metric-grid span {
		color: var(--muted);
		font:
			8px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.metric-grid strong {
		margin-top: 8px;
		color: var(--signal);
		font:
			700 13px ui-monospace,
			SFMono-Regular,
			Menlo,
			Consolas,
			monospace;
	}

	.metric-grid .warning strong {
		color: var(--amber);
	}

	.metric-grid .danger strong {
		color: var(--danger);
	}

	.probe-hud {
		position: fixed;
		z-index: 100;
		top: 0;
		left: 0;
		width: 218px;
		padding: 11px;
		transform: translate3d(var(--hud-x), var(--hud-y), 0);
		border: 1px solid rgba(var(--signal-rgb), 0.58);
		border-radius: 7px;
		background: color-mix(in srgb, var(--panel) 94%, transparent);
		box-shadow: 0 16px 50px rgba(0, 0, 0, 0.32);
		backdrop-filter: blur(12px);
		pointer-events: none;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		will-change: transform;
	}

	.hud-header,
	.probe-hud > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.hud-header {
		margin-bottom: 9px;
		color: var(--signal);
		font-size: 8px;
		letter-spacing: 0.08em;
	}

	.hud-header i {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: var(--signal);
		box-shadow: 0 0 9px var(--signal);
	}

	.probe-hud > strong {
		display: block;
		margin-bottom: 8px;
		overflow: hidden;
		font-size: 10px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.probe-hud > div:not(.hud-header) {
		padding-top: 7px;
		border-top: 1px solid var(--line);
		color: var(--muted);
		font-size: 9px;
	}

	.probe-hud b {
		color: var(--text);
	}

	button,
	select,
	a {
		transition:
			border-color 160ms ease,
			color 160ms ease,
			background-color 160ms ease,
			opacity 160ms ease;
	}

	button:focus-visible,
	select:focus-visible,
	a:focus-visible {
		outline: 2px solid var(--signal);
		outline-offset: 3px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 980px) {
		.hero {
			grid-template-columns: 1fr;
		}

		.compiler-readout {
			width: min(100%, 430px);
		}

		.workbench {
			grid-template-columns: 1fr;
		}

		.control-rail {
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}

		.diagnostic-deck {
			grid-template-columns: 1fr;
		}

		.scope {
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
	}

	@media (max-width: 650px) {
		.simulation-lab {
			padding-inline: 12px;
		}

		.topbar {
			align-items: flex-start;
			padding-block: 12px;
			flex-direction: column;
		}

		.top-actions {
			width: 100%;
			justify-content: space-between;
		}

		.hero {
			padding-block: 34px 24px;
		}

		h1 {
			font-size: clamp(2.35rem, 14vw, 4.1rem);
		}

		.board-toolbar {
			align-items: flex-start;
			flex-direction: column;
		}

		.probe-actions {
			width: 100%;
			justify-content: space-between;
		}

		.schematic-host {
			min-height: 310px;
			padding: 14px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		button,
		select,
		a {
			transition: none;
		}
	}
</style>
