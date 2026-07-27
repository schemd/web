<script lang="ts">
	import { onMount } from 'svelte';
	import type { Pedagogy, SimulationCurriculum } from '$lib/server/simulations';
	import {
		SIMULATION_EVIDENCE_EVENT,
		type SimulationEvidenceDetail
	} from '$lib/simulation-evidence';
	import {
		SIMULATION_PROGRESS_EVENT,
		browserSimulationProgressStorage,
		emptySimulationProgress,
		isLabComplete,
		readSimulationProgress,
		recordDiagnosis,
		recordFaultObservation,
		recordGuidedAction,
		recordPrediction,
		writeSimulationProgress,
		type ProgressStorage,
		type SimulationProgress
	} from '$lib/simulation-progress';

	interface LabLink {
		readonly id: string;
		readonly title: string;
	}

	interface Props {
		readonly id: string;
		readonly title: string;
		readonly version: string;
		readonly fault: string;
		readonly pedagogy: Pedagogy;
		readonly curriculum: SimulationCurriculum;
		readonly prerequisites: readonly LabLink[];
		readonly next?: LabLink;
		readonly host?: HTMLElement;
	}

	let { id, title, version, fault, pedagogy, curriculum, prerequisites, next, host }: Props =
		$props();

	let progress = $state<SimulationProgress>(emptySimulationProgress());
	let storageReady = $state(false);
	let persistenceAvailable = $state(true);
	let mismatch = $state('');
	let diagnosisHypothesis = $state('');
	let diagnosisError = $state('');
	let lastActionAt = 0;
	let loadedVersion = '';
	let activeLab = '';
	let progressStorage: ProgressStorage | undefined;

	const requiredActions = $derived(pedagogy.steps.length);
	const lab = $derived(
		progress.labs[id] ?? {
			actions: 0,
			actionEvents: 0,
			faultObserved: false,
			diagnosisAttempted: false
		}
	);
	const expectedAction = $derived(pedagogy.steps[lab.actions]?.action);
	const committedChoice = $derived(
		pedagogy.prediction.choices.find((choice) => choice.id === lab.predictionChoice)
	);
	const complete = $derived(isLabComplete(progress, id));
	const finishedSteps = $derived(Math.min(requiredActions, lab.actions));
	const incompletePrerequisites = $derived(
		prerequisites.filter((prerequisite) => !isLabComplete(progress, prerequisite.id))
	);

	function publish(nextProgress: SimulationProgress): void {
		progress = nextProgress;
		persistenceAvailable = writeSimulationProgress(progressStorage, version, progress);
		window.dispatchEvent(new CustomEvent(SIMULATION_PROGRESS_EVENT, { detail: { version, id } }));
	}

	function commitPrediction(choiceId: string): void {
		if (!pedagogy.prediction.choices.some((choice) => choice.id === choiceId)) return;
		publish(recordPrediction(progress, id, choiceId, requiredActions));
	}

	function isNontrivialHypothesis(value: string): boolean {
		const normalized = value.trim().replace(/\s+/g, ' ');
		return normalized.length >= 12 && normalized.split(' ').length >= 2;
	}

	function submitDiagnosis(event: SubmitEvent): void {
		event.preventDefault();
		if (expectedAction || !lab.faultObserved || lab.diagnosisAttempted) return;
		if (!isNontrivialHypothesis(diagnosisHypothesis)) {
			diagnosisError = 'State a specific hypothesis using at least two words and 12 characters.';
			return;
		}
		diagnosisError = '';
		/*
		 * Deliberately persist only the attempt bit. A learner's free-text
		 * reasoning belongs to the learner, not local telemetry.
		 */
		publish(recordDiagnosis(progress, id, requiredActions));
		diagnosisHypothesis = '';
	}

	function isMeaningfulControl(target: EventTarget | null): Element | undefined {
		if (!(target instanceof Element)) return undefined;
		const control =
			target.closest(
				'button, input, select, textarea, [role="button"], [role="radio"], [role="switch"]'
			) ?? undefined;
		if (control?.closest('.motion-control, .delay-control')) return undefined;
		return control;
	}

	function canonicalEvent(control: Element): string {
		if (control.matches('[role="switch"], input[type="checkbox"]')) return 'change';
		if (control.matches('input[type="range"], select')) return 'change';
		if (control.matches('input, select, textarea')) return 'input';
		return 'click';
	}

	function controlName(control: Element): string {
		const raw =
			control.getAttribute('aria-label') ??
			control.getAttribute('title') ??
			control.closest('label')?.textContent ??
			control.textContent ??
			control.tagName.toLowerCase();
		const compact = raw.replace(/\s+/g, ' ').trim();
		return compact.length > 64 ? `${compact.slice(0, 61)}…` : compact;
	}

	function recordInteraction(event: Event): void {
		if (!committedChoice) return;
		const control = isMeaningfulControl(event.target);
		if (!control) return;
		if (event.type !== canonicalEvent(control)) return;

		const activatedFault =
			event.type === 'change' &&
			control.matches('.fault-switch [role="switch"]') &&
			control instanceof HTMLInputElement &&
			control.checked;
		let nextProgress = activatedFault
			? recordFaultObservation(progress, id, requiredActions)
			: progress;

		/* Diagnosis is an explicit authored response, never an inferred control event. */
		if (!expectedAction) {
			if (nextProgress !== progress) publish(nextProgress);
			return;
		}

		if (
			expectedAction.sequence
				?.slice(0, lab.actionEvents)
				.some((selector) => control.matches(selector))
		) {
			/* Ignore additional input events from an already-satisfied sequence member. */
			return;
		}
		const activeSelector = expectedAction.sequence?.[lab.actionEvents] ?? expectedAction.selector;
		const matches =
			event.type === expectedAction.event &&
			(control.matches(activeSelector) ||
				(event.target instanceof Element && event.target.closest(activeSelector) !== null));
		/* Restoring a fault is useful circuit control, but it is not evidence
		 * that the hidden-fault condition was observed. */
		const matchesRequiredFault =
			expectedAction.kind !== 'fault' || (activatedFault && control.matches(activeSelector));
		if (!matches || !matchesRequiredFault) {
			if (nextProgress !== progress) publish(nextProgress);
			mismatch = `That changed “${controlName(control)}”. This step asks you to ${expectedAction.instruction}.`;
			return;
		}
		if (expectedAction.outcome) {
			mismatch = `The control changed. Keep experimenting until you ${expectedAction.instruction}.`;
			return;
		}

		const now = performance.now();
		if (!expectedAction.sequence && lastActionAt !== 0 && now - lastActionAt < 320) return;
		lastActionAt = now;
		mismatch = '';
		const acted = recordGuidedAction(nextProgress, id, requiredActions, expectedAction.occurrences);
		publish(acted);
	}

	function recordEvidence(event: Event): void {
		if (!committedChoice || !expectedAction?.outcome) return;
		const detail = (event as CustomEvent<SimulationEvidenceDetail>).detail;
		if (detail.simulationId !== id || detail.outcome !== expectedAction.outcome) return;
		lastActionAt = performance.now();
		mismatch = '';
		publish(recordGuidedAction(progress, id, requiredActions, expectedAction.occurrences));
	}

	onMount(() => {
		progressStorage = browserSimulationProgressStorage();
		persistenceAvailable = progressStorage !== undefined;
		progress = readSimulationProgress(progressStorage, version);
		loadedVersion = version;
		activeLab = id;
		storageReady = true;

		const refresh = (event: Event): void => {
			if (event instanceof StorageEvent && event.key && !event.key.endsWith(`:${version}`)) return;
			progress = readSimulationProgress(progressStorage, version);
		};
		window.addEventListener('storage', refresh);
		return () => {
			window.removeEventListener('storage', refresh);
		};
	});

	$effect(() => {
		if (!storageReady) return;
		if (version !== loadedVersion) {
			progress = readSimulationProgress(progressStorage, version);
			loadedVersion = version;
		}
		if (id !== activeLab) {
			lastActionAt = 0;
			mismatch = '';
			diagnosisHypothesis = '';
			diagnosisError = '';
			activeLab = id;
		}
	});

	$effect(() => {
		const root = host;
		if (!root) return;
		root.addEventListener('click', recordInteraction, true);
		root.addEventListener('input', recordInteraction, true);
		root.addEventListener('change', recordInteraction, true);
		root.addEventListener(SIMULATION_EVIDENCE_EVENT, recordEvidence);
		return () => {
			root.removeEventListener('click', recordInteraction, true);
			root.removeEventListener('input', recordInteraction, true);
			root.removeEventListener('change', recordInteraction, true);
			root.removeEventListener(SIMULATION_EVIDENCE_EVENT, recordEvidence);
		};
	});
</script>

<section class="learning-loop" aria-labelledby={`prediction-${id}`}>
	<div class="curriculum-line">
		<span class="microlabel">recommended lab {curriculum.order} of 13</span>
		<p>{curriculum.objective}</p>
		{#if prerequisites.length > 0}
			<p class="prerequisites">
				<span>Builds on:</span>
				{#each prerequisites as prerequisite, index (prerequisite.id)}
					<a href={`/simulations/${version}/${prerequisite.id}`}>{prerequisite.title}</a>{index <
					prerequisites.length - 1
						? ', '
						: ''}
				{/each}
			</p>
		{:else}
			<p class="prerequisites"><span>Prerequisite:</span> none — start here.</p>
		{/if}
	</div>

	<div class="prediction" class:committed={committedChoice !== undefined}>
		<span class="microlabel prediction-kicker">predict · then test</span>
		<h2 id={`prediction-${id}`}>{@html pedagogy.prediction.promptHtml}</h2>

		{#if committedChoice}
			<div class="commit-result" role="status">
				<p class="commit-label">
					<span aria-hidden="true">✓</span>
					Prediction committed: {@html committedChoice.labelHtml}
				</p>
				<div class="prediction-feedback prose">
					{@html committedChoice.feedbackHtml}
				</div>
				<p class="epistemic-note">
					{committedChoice.correct
						? 'The model supports your prediction. Now make it earn that claim.'
						: 'A useful miss: keep the prediction visible and use the trace to find the broken assumption.'}
				</p>
				<a class="run-link" href="#live-laboratory">Run the experiment ↓</a>
			</div>
		{:else}
			<p class="prediction-rule">
				Commit before the explanation appears. This is a prediction, not a quiz score.
			</p>
			<div class="choice-grid" role="group" aria-label="Prediction choices">
				{#each pedagogy.prediction.choices as choice (choice.id)}
					<button type="button" onclick={() => commitPrediction(choice.id)}>
						{@html choice.labelHtml}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if committedChoice}
		<blockquote class="aha">
			<span class="aha-mark microlabel">the result to explain</span>
			<p>{@html pedagogy.ahaHtml}</p>
		</blockquote>

		<div class="principle">
			<span class="microlabel">why the evidence behaves this way</span>
			<div class="prose">{@html pedagogy.principleHtml}</div>
		</div>

		<div class="walkthrough">
			<div class="walkthrough-head">
				<div>
					<span class="microlabel">evidence loop</span>
					<h2>Make the model answer you.</h2>
				</div>
				<span class="step-count" aria-hidden="true">{finishedSteps}/{requiredActions}</span>
			</div>

			<p
				class="action-feedback"
				class:is-mismatch={mismatch !== ''}
				role="status"
				aria-live="polite"
			>
				{#if mismatch}
					{mismatch}
				{:else if expectedAction}
					Current action: {expectedAction.instruction}{expectedAction.occurrences > 1
						? ` (${lab.actionEvents}/${expectedAction.occurrences} matching interactions)`
						: ''}.
				{:else if !lab.faultObserved}
					Evidence steps complete. Inject the hidden fault and inspect what changes before
					diagnosing it.
				{:else if !lab.diagnosisAttempted}
					Evidence steps complete. Commit a fault hypothesis below.
				{:else}
					Every interaction contract is complete.
				{/if}
			</p>

			{#if incompletePrerequisites.length > 0}
				<p class="prerequisite-warning">
					Recommended first:
					{#each incompletePrerequisites as prerequisite, index (prerequisite.id)}
						<a href={`/simulations/${version}/${prerequisite.id}`}>{prerequisite.title}</a>{index <
						incompletePrerequisites.length - 1
							? ', '
							: ''}
					{/each}. You may continue; this is guidance, not a lock.
				</p>
			{/if}

			<ol class="guided" aria-label="Interactive guided walk-through">
				{#each pedagogy.steps as step, index (step.label)}
					<li
						class="guided-step"
						class:is-complete={lab.actions > index}
						aria-current={lab.actions === index ? 'step' : undefined}
					>
						<span class="step-index" aria-hidden="true">
							{lab.actions > index ? '✓' : index + 1}
						</span>
						<div class="step-body">
							<div class="step-heading">
								<p class="step-label">{@html step.labelHtml}</p>
								<span class="step-state">
									{lab.actions > index
										? 'evidence recorded'
										: lab.actions === index
											? `expected: ${step.action.instruction}`
											: 'follows the previous observation'}
								</span>
							</div>
							<div class="prose step-detail">{@html step.detailHtml}</div>
						</div>
					</li>
				{/each}
			</ol>

			<aside class="diagnosis" class:is-complete={lab.diagnosisAttempted}>
				<span class="microlabel">transfer challenge · fault unknown</span>
				<p>{@html pedagogy.diagnosisPromptHtml}</p>
				{#if lab.diagnosisAttempted}
					<div class="diagnosis-reveal" role="status">
						<span class="diagnosis-state">Diagnosis attempt recorded. Authored answer:</span>
						<strong>{fault}</strong>
						<span class="diagnosis-state"
							>Compare the evidence—not your wording—to decide what you missed.</span
						>
					</div>
				{:else if expectedAction}
					<span class="diagnosis-state">
						The answer remains sealed until every evidence action is complete.
					</span>
				{:else if !lab.faultObserved}
					<span class="diagnosis-state">
						The answer remains sealed until you activate the hidden fault and observe its evidence.
					</span>
				{:else}
					<form class="diagnosis-form" onsubmit={submitDiagnosis} novalidate>
						<label for={`diagnosis-${id}`}>Your fault hypothesis</label>
						<textarea
							id={`diagnosis-${id}`}
							name="diagnosis"
							rows="3"
							minlength="12"
							required
							autocomplete="off"
							bind:value={diagnosisHypothesis}
							aria-describedby={diagnosisError
								? `diagnosis-help-${id} diagnosis-error-${id}`
								: `diagnosis-help-${id}`}></textarea>
						<span id={`diagnosis-help-${id}`} class="diagnosis-state">
							Name the suspected mechanism and the evidence that led you there. This text is not
							saved.
						</span>
						{#if diagnosisError}
							<span id={`diagnosis-error-${id}`} class="diagnosis-error" role="alert">
								{diagnosisError}
							</span>
						{/if}
						<button type="submit">Commit hypothesis and reveal answer</button>
					</form>
				{/if}
			</aside>

			<p class="progress-announcement" role="status" aria-live="polite">
				{#if complete}
					Lab complete: prediction, {requiredActions} observations, and diagnosis recorded.
				{:else if storageReady}
					{persistenceAvailable ? 'Progress saved locally' : 'Progress held for this page only'}:
					{finishedSteps} of {requiredActions} observations and {lab.diagnosisAttempted
						? 'one diagnosis'
						: 'no diagnosis yet'}; hidden-fault evidence {lab.faultObserved
						? 'observed'
						: 'not yet observed'}.
				{:else}
					Loading local progress.
				{/if}
			</p>

			{#if complete}
				<div class="completion">
					<div>
						<span class="microlabel">experiment complete</span>
						<strong>{title}</strong>
					</div>
					{#if next}
						<a href={`/simulations/${version}/${next.id}`}>
							Continue to {next.title} →
						</a>
					{:else}
						<a href={`/simulations/${version}`}>Review the completed curriculum →</a>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</section>

<style>
	.learning-loop {
		display: grid;
		gap: var(--space-4);
	}

	.curriculum-line {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: baseline;
		gap: var(--space-3);
		padding-block: var(--space-2);
		border-block: 1px solid var(--line);

		& p {
			margin: 0;
			font-size: var(--text-xs);
			color: var(--ink-mute);
		}
	}

	.prerequisites {
		text-align: end;

		& span {
			color: var(--ink-faint);
		}
	}

	.prediction {
		display: grid;
		gap: var(--space-3);
		padding: clamp(var(--space-4), 3vw, var(--space-6));
		border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--line));
		border-inline-start: 4px solid var(--accent);
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--accent) 9%, transparent), transparent 58%),
			var(--bg-inset);

		& h2 {
			max-inline-size: 45ch;
			font-size: var(--text-lg);
			line-height: 1.35;
			text-wrap: balance;
		}
	}

	.prediction-kicker {
		color: var(--accent);
	}

	.prediction-rule,
	.epistemic-note {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.choice-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-2);

		& button {
			min-block-size: 3.2rem;
			padding: var(--space-3) var(--space-4);
			border: 1px solid var(--line-strong);
			background: var(--bg-raised);
			color: var(--ink);
			text-align: start;
			font-size: var(--text-sm);
			line-height: 1.45;

			&:hover {
				border-color: var(--accent);
				background: color-mix(in srgb, var(--accent) 8%, var(--bg-raised));
			}
		}
	}

	.commit-result {
		display: grid;
		gap: var(--space-2);
	}

	.commit-label {
		margin: 0;
		color: var(--ink);
		font-weight: 600;

		& > span {
			color: var(--accent);
			margin-inline-end: var(--space-1);
		}
	}

	.run-link {
		justify-self: start;
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.aha {
		margin: 0;
		padding: var(--space-4) var(--space-5);
		background: color-mix(in srgb, var(--accent) 8%, var(--bg-inset));
		border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--line));
		display: grid;
		gap: var(--space-2);

		& p {
			margin: 0;
			font-size: var(--text-lg);
			line-height: 1.4;
			letter-spacing: -0.01em;
			color: var(--ink);
			text-wrap: balance;
		}
	}

	.aha-mark {
		color: var(--accent);
	}

	.principle {
		display: grid;
		gap: var(--space-2);
	}

	.prose {
		color: var(--ink-mute);
		line-height: 1.7;
		font-size: var(--text-sm);

		& :global(strong) {
			color: var(--ink);
			font-weight: 600;
		}

		& :global(code) {
			font-family: var(--font-mono);
			font-size: 0.9em;
			padding: 0.05em 0.35em;
			background: var(--bg-inset);
			border: 1px solid var(--line);
			border-radius: 4px;
		}

		& :global(.katex-display) {
			margin: var(--space-3) 0;
			overflow-x: auto;
			overflow-y: hidden;
		}
	}

	.walkthrough {
		display: grid;
		gap: var(--space-3);
	}

	.walkthrough-head {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: var(--space-4);

		& h2 {
			font-size: var(--text-md);
		}
	}

	.step-count {
		font-family: var(--font-mono);
		font-size: var(--text-lg);
		color: var(--accent);
	}

	.action-feedback {
		margin: 0;
		padding: var(--space-3);
		border: 1px solid var(--line);
		background: var(--bg-inset);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-mute);

		&.is-mismatch {
			border-color: var(--danger);
			color: var(--danger);
		}
	}

	.prerequisite-warning {
		margin: 0;
		padding: var(--space-3);
		border: 1px solid var(--line);
		background: var(--bg-inset);
		color: var(--ink-mute);
		font-size: var(--text-xs);
	}

	.guided {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
	}

	.guided-step {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--bg-panel);

		&[aria-current='step'] {
			background: color-mix(in srgb, var(--accent) 6%, var(--bg-panel));
			box-shadow: inset 3px 0 0 var(--accent);
		}

		&.is-complete {
			background: color-mix(in srgb, var(--ok) 5%, var(--bg-panel));
		}
	}

	.step-index {
		display: grid;
		place-items: center;
		inline-size: 1.6rem;
		block-size: 1.6rem;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--accent-ink);
		background: var(--accent);
		border-radius: 999px;
	}

	.is-complete .step-index {
		background: var(--ok);
	}

	.step-body {
		display: grid;
		gap: var(--space-1);
		min-inline-size: 0;
	}

	.step-heading {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-3);
	}

	.step-label {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--ink);
	}

	.step-state,
	.diagnosis-state {
		font-family: var(--font-mono);
		font-size: var(--text-2xs);
		color: var(--ink-faint);
	}

	.is-complete .step-state {
		color: var(--ok);
	}

	.step-detail {
		font-size: var(--text-xs);
	}

	.diagnosis {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
		border: 1px dashed var(--line-strong);
		background: var(--bg-inset);

		& p {
			margin: 0;
			color: var(--ink);
			font-size: var(--text-sm);
			line-height: 1.6;
		}

		&.is-complete {
			border-color: var(--ok);
		}
	}

	.diagnosis-form,
	.diagnosis-reveal {
		display: grid;
		gap: var(--space-2);
	}

	.diagnosis-form {
		& label {
			color: var(--ink);
			font-size: var(--text-xs);
			font-weight: 600;
		}

		& textarea {
			inline-size: 100%;
			min-block-size: 5rem;
			resize: vertical;
			padding: var(--space-3);
			border: 1px solid var(--line-strong);
			background: var(--bg-panel);
			color: var(--ink);
			font: inherit;
			line-height: 1.5;

			&:focus-visible {
				outline: 2px solid var(--accent);
				outline-offset: 2px;
			}
		}

		& button {
			justify-self: start;
			padding: var(--space-2) var(--space-3);
			border: 1px solid var(--accent);
			background: var(--accent);
			color: var(--accent-ink);
			font-weight: 600;
		}
	}

	.diagnosis-reveal {
		padding: var(--space-3);
		border-inline-start: 3px solid var(--ok);
		background: color-mix(in srgb, var(--ok) 7%, var(--bg-panel));

		& strong {
			color: var(--ink);
			font-size: var(--text-sm);
		}
	}

	.diagnosis-error {
		color: var(--danger);
		font-size: var(--text-xs);
	}

	.progress-announcement {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--ink-mute);
	}

	.completion {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-4);
		border: 1px solid var(--ok);
		background: color-mix(in srgb, var(--ok) 7%, var(--bg-panel));

		& div {
			display: grid;
			gap: var(--space-1);
		}
	}

	@media (max-width: 760px) {
		.curriculum-line {
			grid-template-columns: 1fr;
		}

		.prerequisites {
			text-align: start;
		}

		.choice-grid {
			grid-template-columns: 1fr;
		}

		.step-heading,
		.completion {
			align-items: start;
			flex-direction: column;
		}
	}
</style>
