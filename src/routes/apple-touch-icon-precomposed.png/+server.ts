import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Answer WebKit's legacy touch-icon probe without shipping a second image.
 *
 * Safari asks for `/apple-touch-icon-precomposed.png` at the site root before
 * it falls back to `apple-touch-icon.png`, and it does so whether or not the
 * document declares one — which logged a 404 on every cold load. `app.html`
 * now declares the precomposed relation so a client that reads the markup never
 * needs to guess, and this handler covers the ones that probe the path anyway.
 *
 * A permanent redirect rather than a copy of the file: the bytes are identical,
 * and duplicating a binary in `static/` means the two can later disagree.
 */
export const GET: RequestHandler = () => {
	redirect(301, '/apple-touch-icon.png');
};

/*
 * Explicitly not prerendered. The prerenderer has nowhere to put a redirect
 * whose target is a static file rather than a route, so it reports the 301 as
 * a failed page and stops the build. Adapter-node answers this at runtime for
 * the cost of one header, and the response is permanently cacheable anyway.
 */
export const prerender = false;
