// SSE endpoint for real-time data updates on the Readout page.
// Uses sveltekit-sse produce() for connection lifecycle management
// and the singleton chokidar watcher for file change detection.
//
// Security: This app is localhost-only (bound to 127.0.0.1).
// No auth required per spec -- single-user, no deployment.
//
// Supports both POST (sveltekit-sse default) and GET (SSE convention).

import { produce } from 'sveltekit-sse';
import { subscribe, type SSEEvent } from '$lib/server/watcher.js';
import { warn } from '$lib/server/telemetry/logger.js';
import type { RequestHandler } from './$types';

function createSSEResponse(): Response {
	return produce(
		function start({ emit, lock }) {
			let unsubscribed = false;

			function cleanup() {
				if (!unsubscribed) {
					unsubscribed = true;
					unsubscribe();
					lock.set(false);
				}
			}

			const unsubscribe = subscribe((event: SSEEvent) => {
				if (unsubscribed) return;

				let payload: string;
				try {
					payload = JSON.stringify(event);
				} catch (err) {
					warn('sse', 'Failed to serialize event', {
						'error.type': err instanceof Error ? err.name : 'unknown',
						'error.stack': err instanceof Error ? err.stack : undefined
					});
					cleanup();
					return;
				}

				// Emit the full event payload (type, data, timestamp, seq) so the
				// client can use the server-side seq/timestamp for ordering.
				const { error } = emit(event.type, payload);
				if (error) {
					// Client disconnected -- unsubscribe immediately
					cleanup();
					return;
				}
			});

			return function stop() {
				cleanup();
			};
		},
		{
			ping: 15_000,
			headers: {
				'X-Accel-Buffering': 'no',
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		}
	);
}

// POST: sveltekit-sse default method
export const POST: RequestHandler = () => createSSEResponse();

// GET: standard SSE convention (proxies/tools expect GET for EventSource)
export const GET: RequestHandler = () => createSSEResponse();
