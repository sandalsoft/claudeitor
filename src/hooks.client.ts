import type { HandleClientError } from '@sveltejs/kit';

const TELEMETRY_ENDPOINT = '/api/telemetry';

/**
 * Sends a client-side telemetry record to the server.
 * Fire-and-forget — never throws, never blocks UI.
 */
function sendTelemetry(record: Record<string, unknown>): void {
	try {
		// Use sendBeacon for reliability on page unload; fall back to fetch
		const payload = JSON.stringify(record);
		const sent = navigator.sendBeacon?.(TELEMETRY_ENDPOINT, payload);
		if (!sent) {
			fetch(TELEMETRY_ENDPOINT, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: payload,
				keepalive: true
			}).catch(() => {
				// Silently swallow — we're the error reporter, can't recurse
			});
		}
	} catch {
		// Swallow — telemetry must never break the app
	}
}

/**
 * SvelteKit's handleError hook — catches unhandled errors during rendering,
 * load functions, and event handlers that bubble up to Svelte's error boundary.
 */
export const handleError: HandleClientError = ({ error, message, status }) => {
	const err = error instanceof Error ? error : new Error(String(error));

	sendTelemetry({
		recordType: 'client-error',
		timestamp: Date.now(),
		severityText: 'ERROR',
		severityNumber: 17,
		body: err.message || message,
		attributes: {
			'error.type': err.name,
			'error.stack': err.stack?.slice(0, 2048),
			'error.status': status,
			'error.sveltekit_message': message,
			'page.url': globalThis.location?.href,
			'client.hook': 'handleError'
		}
	});

	return {
		message: 'An unexpected error occurred'
	};
};

/**
 * Catch unhandled promise rejections that escape Svelte's error boundary.
 * These include rejected promises in event handlers, setTimeout callbacks,
 * and third-party scripts.
 */
if (typeof window !== 'undefined') {
	window.addEventListener('unhandledrejection', (event) => {
		const reason = event.reason;
		const err = reason instanceof Error ? reason : new Error(String(reason));

		sendTelemetry({
			recordType: 'client-error',
			timestamp: Date.now(),
			severityText: 'ERROR',
			severityNumber: 17,
			body: err.message,
			attributes: {
				'error.type': err.name,
				'error.stack': err.stack?.slice(0, 2048),
				'page.url': globalThis.location?.href,
				'client.hook': 'unhandledrejection'
			}
		});
	});

	window.addEventListener('error', (event) => {
		// Skip errors from cross-origin scripts (no useful info)
		if (event.message === 'Script error.' && !event.filename) return;

		sendTelemetry({
			recordType: 'client-error',
			timestamp: Date.now(),
			severityText: 'ERROR',
			severityNumber: 17,
			body: event.message,
			attributes: {
				'error.type': 'WindowError',
				'error.filename': event.filename,
				'error.lineno': event.lineno,
				'error.colno': event.colno,
				'error.stack': event.error?.stack?.slice(0, 2048),
				'page.url': globalThis.location?.href,
				'client.hook': 'window.onerror'
			}
		});
	});
}
