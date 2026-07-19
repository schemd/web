/**
 * Global UI state as a Svelte 5 runes module.
 *
 * Blueprint mode and the auditory-feedback switch are platform-wide, so they
 * live here instead of being threaded through props. Persistence uses
 * `localStorage` guarded for SSR.
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

function storedBlueprint(): BlueprintMode {
	if (!browser) return 'hud';
	const raw = localStorage.getItem('schemd:blueprint');
	return raw === 'cyanotype' || raw === 'iso' ? raw : 'hud';
}

/** Platform-wide reactive UI state. */
export const ui = $state({
	blueprint: storedBlueprint() as BlueprintMode,
	audio: browser ? localStorage.getItem('schemd:audio') === '1' : false,
	paletteOpen: false
});

/** Switch blueprint mode, syncing the document attribute and storage. */
export function setBlueprint(mode: BlueprintMode): void {
	ui.blueprint = mode;
	if (browser) {
		document.documentElement.dataset.blueprint = mode;
		localStorage.setItem('schemd:blueprint', mode);
	}
}

/** Toggle the auditory feedback soundscape. */
export function setAudio(enabled: boolean): void {
	ui.audio = enabled;
	if (browser) localStorage.setItem('schemd:audio', enabled ? '1' : '0');
}
