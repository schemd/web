/**
 * Small, version-scoped persistence model for the simulation curriculum.
 *
 * The browser is the only persistence boundary: there is no account, cookie,
 * telemetry event, or server write. Every reader goes through the defensive
 * decoder because localStorage is user-controlled input.
 */
export const SIMULATION_PROGRESS_SCHEMA = 1 as const;
export const SIMULATION_PROGRESS_EVENT = 'schemd:simulation-progress';

const STORAGE_PREFIX = `schemd.simulation-progress.v${SIMULATION_PROGRESS_SCHEMA}`;
const MAX_LABS = 64;
const MAX_CHOICE_LENGTH = 80;
const MAX_SERIALIZED_LENGTH = 64_000;

export interface LabProgress {
	readonly predictionChoice?: string;
	/** Number of fully satisfied guided-step contracts. */
	readonly actions: number;
	/** Matching interactions accumulated toward the current step contract. */
	readonly actionEvents: number;
	/** The learner has activated the lab's hidden fault and observed its evidence. */
	readonly faultObserved: boolean;
	readonly diagnosisAttempted: boolean;
	readonly completedAt?: string;
}

export interface SimulationProgress {
	readonly schema: typeof SIMULATION_PROGRESS_SCHEMA;
	readonly labs: Readonly<Record<string, LabProgress>>;
}

export interface ProgressStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

/** Resolve browser storage without letting a SecurityError escape the caller. */
export function browserSimulationProgressStorage(): ProgressStorage | undefined {
	if (typeof window === 'undefined') return undefined;
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

export function simulationProgressKey(version: string): string {
	return `${STORAGE_PREFIX}:${version}`;
}

export function emptySimulationProgress(): SimulationProgress {
	return { schema: SIMULATION_PROGRESS_SCHEMA, labs: {} };
}

function validText(value: unknown, maxLength: number): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function decodeLab(value: unknown): LabProgress | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
	const record = value as Record<string, unknown>;
	const predictionChoice = validText(record.predictionChoice, MAX_CHOICE_LENGTH)
		? record.predictionChoice
		: undefined;
	const actions =
		typeof record.actions === 'number' && Number.isSafeInteger(record.actions)
			? Math.max(0, Math.min(32, record.actions))
			: 0;
	const actionEvents =
		typeof record.actionEvents === 'number' && Number.isSafeInteger(record.actionEvents)
			? Math.max(0, Math.min(64, record.actionEvents))
			: 0;
	const faultObserved = record.faultObserved === true;
	const diagnosisAttempted = record.diagnosisAttempted === true;
	const completedAt =
		predictionChoice !== undefined &&
		actions > 0 &&
		faultObserved &&
		diagnosisAttempted &&
		validText(record.completedAt, 64) &&
		!Number.isNaN(Date.parse(record.completedAt))
			? record.completedAt
			: undefined;
	return {
		predictionChoice,
		actions,
		actionEvents,
		faultObserved,
		diagnosisAttempted,
		completedAt
	};
}

/** Decode hostile or stale persistence into a bounded, inert value. */
export function parseSimulationProgress(serialized: string | null): SimulationProgress {
	if (!serialized) return emptySimulationProgress();
	if (serialized.length > MAX_SERIALIZED_LENGTH) return emptySimulationProgress();
	try {
		const value: unknown = JSON.parse(serialized);
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			return emptySimulationProgress();
		}
		const record = value as Record<string, unknown>;
		if (record.schema !== SIMULATION_PROGRESS_SCHEMA) return emptySimulationProgress();
		if (typeof record.labs !== 'object' || record.labs === null || Array.isArray(record.labs)) {
			return emptySimulationProgress();
		}

		const labs: Record<string, LabProgress> = {};
		for (const [id, candidate] of Object.entries(record.labs).slice(0, MAX_LABS)) {
			if (!/^[a-z][a-z0-9-]{0,31}$/.test(id)) continue;
			const lab = decodeLab(candidate);
			if (lab) labs[id] = lab;
		}
		return { schema: SIMULATION_PROGRESS_SCHEMA, labs };
	} catch {
		return emptySimulationProgress();
	}
}

export function readSimulationProgress(
	storage: ProgressStorage | undefined,
	version: string
): SimulationProgress {
	if (!storage) return emptySimulationProgress();
	try {
		return parseSimulationProgress(storage.getItem(simulationProgressKey(version)));
	} catch {
		/* Safari private mode and policy-controlled storage may throw on reads. */
		return emptySimulationProgress();
	}
}

export function writeSimulationProgress(
	storage: ProgressStorage | undefined,
	version: string,
	progress: SimulationProgress
): boolean {
	if (!storage) return false;
	try {
		storage.setItem(simulationProgressKey(version), JSON.stringify(progress));
		return true;
	} catch {
		/* Progress is an enhancement; a blocked/quota-full store must not break a lab. */
		return false;
	}
}

function updateLab(
	progress: SimulationProgress,
	id: string,
	update: (previous: LabProgress) => LabProgress
): SimulationProgress {
	if (!/^[a-z][a-z0-9-]{0,31}$/.test(id)) return progress;
	const previous = progress.labs[id] ?? {
		actions: 0,
		actionEvents: 0,
		faultObserved: false,
		diagnosisAttempted: false
	};
	return {
		schema: SIMULATION_PROGRESS_SCHEMA,
		labs: { ...progress.labs, [id]: update(previous) }
	};
}

function withCompletion(lab: LabProgress, requiredActions: number, now: string): LabProgress {
	const complete =
		lab.predictionChoice !== undefined &&
		lab.actions >= requiredActions &&
		lab.faultObserved &&
		lab.diagnosisAttempted;
	if (!complete || lab.completedAt) return lab;
	return { ...lab, completedAt: now };
}

export function recordPrediction(
	progress: SimulationProgress,
	id: string,
	choice: string,
	requiredActions: number,
	now = new Date().toISOString()
): SimulationProgress {
	if (!validText(choice, MAX_CHOICE_LENGTH)) return progress;
	return updateLab(progress, id, (previous) =>
		withCompletion({ ...previous, predictionChoice: choice }, requiredActions, now)
	);
}

export function recordLabAction(
	progress: SimulationProgress,
	id: string,
	requiredActions: number,
	now = new Date().toISOString()
): SimulationProgress {
	return recordGuidedAction(progress, id, requiredActions, 1, now);
}

/**
 * Record one event that matched the current step's declared action contract.
 * A multi-event experiment (for example, fifteen LFSR clocks) advances only
 * after the required number of matching events, never after unrelated clicks.
 */
export function recordGuidedAction(
	progress: SimulationProgress,
	id: string,
	requiredActions: number,
	requiredOccurrences: number,
	now = new Date().toISOString()
): SimulationProgress {
	const boundedOccurrences = Math.max(1, Math.min(64, Math.trunc(requiredOccurrences)));
	return updateLab(progress, id, (previous) => {
		const eventCount = previous.actionEvents + 1;
		const completedStep = eventCount >= boundedOccurrences;
		return withCompletion(
			{
				...previous,
				actions: completedStep ? Math.min(requiredActions, previous.actions + 1) : previous.actions,
				actionEvents: completedStep ? 0 : eventCount
			},
			requiredActions,
			now
		);
	});
}

export function recordDiagnosis(
	progress: SimulationProgress,
	id: string,
	requiredActions: number,
	now = new Date().toISOString()
): SimulationProgress {
	return updateLab(progress, id, (previous) =>
		withCompletion({ ...previous, diagnosisAttempted: true }, requiredActions, now)
	);
}

/**
 * Record that the learner activated the deliberately unnamed fault.
 *
 * Restoring the circuit does not erase the observation: this is curriculum
 * evidence, not a mirror of the switch's current UI state.
 */
export function recordFaultObservation(
	progress: SimulationProgress,
	id: string,
	requiredActions: number,
	now = new Date().toISOString()
): SimulationProgress {
	return updateLab(progress, id, (previous) =>
		withCompletion({ ...previous, faultObserved: true }, requiredActions, now)
	);
}

export function isLabComplete(progress: SimulationProgress, id: string): boolean {
	return progress.labs[id]?.completedAt !== undefined;
}

export function completedLabCount(
	progress: SimulationProgress,
	knownLabIds: readonly string[]
): number {
	return knownLabIds.reduce((count, id) => count + Number(isLabComplete(progress, id)), 0);
}
