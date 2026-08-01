/**
 * Every laboratory that has been migrated to a manifest.
 *
 * Migration is incremental on purpose. A lab appears here once its manifest is
 * proven to drive the same drawing as the component it replaces; until then the
 * bespoke component stays registered in the route and nothing changes for a
 * reader.
 *
 * Three of the shape-proving cases the specification names are done: the two
 * discrete-state labs, and one quantum (`bell`, which needed nothing new
 * because its model already takes the timeline stage).
 *
 * **`rc` was migrated and then reverted, which is the most useful finding so
 * far.** The manifest drove the drawing correctly — a `style` binding even
 * reproduced the trace fading with attenuation — but the accessibility suite
 * caught two capabilities the interpreter does not have and the bespoke
 * component does: a live KaTeX readout whose visual and MathML values are
 * patched together, and a reduced-motion control for its 60 FPS waveform. A
 * migration that quietly drops either is a downgrade, so continuous-waveform
 * labs stay bespoke until the schema can express animated instruments and
 * math-slot readouts.
 *
 * The two the schema could not reach at all — the Chua oscillator and the PLL,
 * which integrate continuously and carry state between frames — have been
 * retired from the catalogue rather than left as permanent exceptions.
 *
 * **Manifests are lazily loaded, exactly like the components they replace.**
 * The route deliberately downloads one laboratory rather than thirteen, and a
 * migrated lab must not quietly opt out of that by being a static import — so
 * only the id list is eager, and it is a handful of strings.
 */
import type { LabManifest } from '../lab-manifest';

type ManifestLoader = () => Promise<{ readonly manifest: LabManifest }>;

const LOADERS: Readonly<Record<string, ManifestLoader>> = {
	adder: async () => ({ manifest: (await import('./adder')).adderLab }),
	bell: async () => ({ manifest: (await import('./bell')).bellLab }),
	lfsr: async () => ({ manifest: (await import('./lfsr')).lfsrLab })
};

/** Ids driven by a manifest. Eager, because the route branches on it. */
export const DECLARATIVE_LAB_IDS: readonly string[] = Object.freeze(Object.keys(LOADERS));

/** Whether a laboratory is driven by a manifest rather than a component. */
export function isDeclarativeLab(id: string): boolean {
	return Object.hasOwn(LOADERS, id);
}

/**
 * Load one manifest.
 *
 * Rejects rather than resolving `undefined` for an unknown id: the route only
 * calls this after {@link isDeclarativeLab}, so an unknown id here is a
 * programming error and should read like one.
 */
export async function loadLabManifest(id: string): Promise<LabManifest> {
	const loader = LOADERS[id];
	if (!loader) throw new Error(`No lab manifest registered for ${id}.`);
	return (await loader()).manifest;
}

/** Every manifest, for tests and tooling that need to check them all at once. */
export async function allLabManifests(): Promise<readonly LabManifest[]> {
	return Promise.all(DECLARATIVE_LAB_IDS.map((id) => loadLabManifest(id)));
}
