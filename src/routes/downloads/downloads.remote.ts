/**
 * Live download telemetry, streamed to the browser.
 *
 * `query.live` keeps one streaming response open per reader and pushes each
 * new reading down it. The generator itself does no network work: it observes
 * the process-wide poller in `$lib/server/downloads`, so a hundred open tabs
 * still cost npm one request a minute.
 */
import { getRequestEvent, query } from '$app/server';
import { downloadStore, type DownloadSnapshot } from '$lib/server/downloads';

export const liveDownloads = query.live(async function* (): AsyncGenerator<DownloadSnapshot> {
	/* The request's signal aborts when the reader disconnects, which is what
	 * ends the loop and releases its slot on the shared poller. */
	const { request } = getRequestEvent();
	yield* downloadStore.watch(request.signal);
});
