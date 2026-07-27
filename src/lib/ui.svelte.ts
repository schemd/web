/**
 * Global UI state as a Svelte 5 runes module.
 *
 * Blueprint mode and the auditory-feedback switch are platform-wide, so they
 * live here instead of being threaded through props. The exported state always
 * starts from the server defaults so hydration sees identical markup. Stored
 * preferences are applied explicitly after mount.
 */
import { browser } from '$app/environment';

/** The three blueprint representation states. */
export const BLUEPRINT_MODES = ['hud', 'cyanotype', 'iso'] as const;
export type BlueprintMode = (typeof BLUEPRINT_MODES)[number];

export const BLUEPRINT_LABELS: Record<BlueprintMode, string> = {
	hud: 'Laboratory HUD',
	cyanotype: 'Cyanotype blueprint',
	iso: 'ISO print'
};

export function parseBlueprintPreference(raw: string | null): BlueprintMode {
	return raw === 'cyanotype' || raw === 'iso' ? raw : 'hud';
}

function readPreference(key: string): string | null {
	if (!browser) return null;
	try {
		return localStorage.getItem(key);
	} catch {
		/* Storage can be blocked by privacy policy or an opaque origin. */
		return null;
	}
}

function writePreference(key: string, value: string): void {
	if (!browser) return;
	try {
		localStorage.setItem(key, value);
	} catch {
		/* A preference must never make the interface unusable. */
	}
}

/** Platform-wide reactive UI state. */
export const ui = $state({
	blueprint: 'hud' as BlueprintMode,
	audio: false,
	paletteOpen: false,
	/** Docs left-sidebar collapse — persists across navigation and reloads. */
	docsNavCollapsed: false
});

let preferencesHydrated = false;

/**
 * Apply persisted preferences after Svelte has hydrated the server markup.
 * Idempotence matters because the root layout survives client navigation.
 */
export function hydrateUiPreferences(): void {
	if (!browser || preferencesHydrated) return;
	preferencesHydrated = true;
	ui.blueprint = parseBlueprintPreference(readPreference('schemd:blueprint'));
	ui.audio = readPreference('schemd:audio') === '1';
	ui.docsNavCollapsed = readPreference('schemd:docsNav') === 'collapsed';
	document.documentElement.dataset.blueprint = ui.blueprint;
}

/** Collapse or expand the docs index tree, syncing storage. */
export function setDocsNavCollapsed(collapsed: boolean): void {
	ui.docsNavCollapsed = collapsed;
	writePreference('schemd:docsNav', collapsed ? 'collapsed' : 'expanded');
}

/** Switch blueprint mode, syncing the document attribute and storage. */
export function setBlueprint(mode: BlueprintMode): void {
	ui.blueprint = mode;
	if (browser) {
		document.documentElement.dataset.blueprint = mode;
		writePreference('schemd:blueprint', mode);
	}
}

/** Toggle the auditory feedback soundscape. */
export function setAudio(enabled: boolean): void {
	ui.audio = enabled;
	writePreference('schemd:audio', enabled ? '1' : '0');
}
