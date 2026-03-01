// Real-time data store using SSE for the Readout page.
// Connects to /api/sse, receives typed events, and updates reactive state.
// Implements exponential backoff reconnection on disconnect.
//
// Reconnection strategy: always tear down and create a fresh Source.
// We never use the library's built-in reconnect callback because it
// reconnects the same underlying connection while our store tracking
// would be out of sync. Creating a fresh Source keeps state consistent.

import { source } from 'sveltekit-sse';
import type { StatsCache, CostCache, SessionEntry } from '../data/types.js';

// ─── Connection State ────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ─── Backoff Configuration ───────────────────────────────────

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

// ─── Store ───────────────────────────────────────────────────

interface SSEPayload {
	type: string;
	data: unknown;
	timestamp: number;
}

function createRealtimeStore() {
	let stats = $state<StatsCache | null>(null);
	let costs = $state<CostCache | null>(null);
	let sessions = $state<SessionEntry[] | null>(null);
	let status = $state<ConnectionStatus>('disconnected');
	let lastEventAt = $state<number | null>(null);

	let connection: ReturnType<typeof source> | null = null;
	let storeUnsubscribers: Array<() => void> = [];
	let backoffMs = INITIAL_BACKOFF_MS;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let intentionalClose = false;

	function teardownConnection() {
		// Unsubscribe from all Svelte readable stores first
		for (const unsub of storeUnsubscribers) {
			unsub();
		}
		storeUnsubscribers = [];

		// Close the SSE connection
		if (connection) {
			connection.close();
			connection = null;
		}
	}

	function connect() {
		if (connection) return;

		intentionalClose = false;
		status = 'connecting';

		connection = source('/api/sse', {
			open() {
				status = 'connected';
				backoffMs = INITIAL_BACKOFF_MS;
			},
			close() {
				// Tear down everything -- we will reconnect with a fresh Source
				teardownConnection();

				if (intentionalClose) {
					status = 'disconnected';
					return;
				}

				status = 'error';
				scheduleReconnect();
			},
			error() {
				teardownConnection();

				if (intentionalClose) {
					status = 'disconnected';
					return;
				}

				status = 'error';
				scheduleReconnect();
			},
			options: {
				method: 'POST'
			}
		});

		// Subscribe to each event type.
		// The server emits full SSEEvent payloads (with type, data, timestamp).
		const statsStore = connection.select('stats-update').json<SSEPayload>();
		const costsStore = connection.select('cost-update').json<SSEPayload>();
		const sessionsStore = connection.select('session-update').json<SSEPayload>();

		// Track unsubscribe functions so we can clean up on disconnect
		storeUnsubscribers.push(
			statsStore.subscribe((value) => {
				if (value != null) {
					stats = value.data as StatsCache;
					lastEventAt = value.timestamp ?? Date.now();
				}
			})
		);

		storeUnsubscribers.push(
			costsStore.subscribe((value) => {
				if (value != null) {
					costs = value.data as CostCache;
					lastEventAt = value.timestamp ?? Date.now();
				}
			})
		);

		storeUnsubscribers.push(
			sessionsStore.subscribe((value) => {
				if (value != null) {
					sessions = value.data as SessionEntry[];
					lastEventAt = value.timestamp ?? Date.now();
				}
			})
		);
	}

	function scheduleReconnect() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
		}

		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			if (intentionalClose) return;

			// Always create a fresh connection
			connect();

			// Exponential backoff with cap
			backoffMs = Math.min(backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
		}, backoffMs);
	}

	function disconnect() {
		intentionalClose = true;

		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}

		teardownConnection();

		status = 'disconnected';
		backoffMs = INITIAL_BACKOFF_MS;
	}

	return {
		get stats() {
			return stats;
		},
		get costs() {
			return costs;
		},
		get sessions() {
			return sessions;
		},
		get status() {
			return status;
		},
		get lastEventAt() {
			return lastEventAt;
		},

		connect,
		disconnect,

		/** Reset backoff and reconnect immediately. */
		reconnectNow() {
			backoffMs = INITIAL_BACKOFF_MS;
			disconnect();
			connect();
		}
	};
}

export const realtime = createRealtimeStore();
