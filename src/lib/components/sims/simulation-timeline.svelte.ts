import { getContext, setContext } from 'svelte';

export type SimulationTimelineAction = 'next' | 'previous' | 'play' | 'pause' | 'reset' | 'seek';

/**
 * The single causal clock shared by a lab's SVG, numerical model, and local
 * transport controls. Context keeps all three on one reactive state object:
 * no duplicate timers, window listeners, or eventually-consistent events.
 */
export class SimulationTimelineModel {
	step = $state(0);
	runId = $state(0);
	playing = $state(false);
	count = $state(0);

	restart(playing = false): void {
		this.step = 0;
		this.runId += 1;
		this.playing = playing;
	}

	command(action: SimulationTimelineAction, value = 0): void {
		const end = Math.max(0, this.count - 1);
		switch (action) {
			case 'next':
				this.step = Math.min(end, this.step + 1);
				break;
			case 'previous':
				this.playing = false;
				this.step = Math.max(0, this.step - 1);
				break;
			case 'play':
				if (this.step >= end) this.restart(true);
				else this.playing = true;
				break;
			case 'pause':
				this.playing = false;
				break;
			case 'seek':
				this.playing = false;
				this.step = Math.max(0, Math.min(end, Math.trunc(value)));
				break;
			default:
				this.restart();
		}
	}
}

const TIMELINE_CONTEXT = {};

export function provideSimulationTimelineModel(): SimulationTimelineModel {
	return setContext(TIMELINE_CONTEXT, new SimulationTimelineModel());
}

export function useSimulationTimelineModel(): SimulationTimelineModel {
	return getContext(TIMELINE_CONTEXT);
}
