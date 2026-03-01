// SSE endpoint for real-time data updates on the Readout page.
// Uses sveltekit-sse produce() for connection lifecycle management
// and the singleton chokidar watcher for file change detection.
//
// Security: This app is localhost-only (bound to 127.0.0.1).
// No auth required per spec -- single-user, no deployment.

import { produce } from 'sveltekit-sse';
import { subscribe, type SSEEvent } from '$lib/server/watcher.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = () => {
	return produce(
		function start({ emit, lock }) {
			let unsubscribed = false;

			const unsubscribe = subscribe((event: SSEEvent) => {
				if (unsubscribed) return;

				// Emit the full event payload (type, data, timestamp) so the
				// client can use the server-side timestamp for staleness checks.
				const { error } = emit(event.type, JSON.stringify(event));
				if (error) {
					// Client disconnected -- unsubscribe immediately to stop
					// wasted reads, and unlock the stream to end it.
					unsubscribed = true;
					unsubscribe();
					lock.set(false);
					return;
				}
			});

			// Return the stop function that cleans up when client disconnects
			return function stop() {
				if (!unsubscribed) {
					unsubscribed = true;
					unsubscribe();
				}
			};
		},
		{
			// Ping every 15 seconds to detect stale connections
			ping: 15_000,
			headers: {
				'X-Accel-Buffering': 'no',
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		}
	);
};
