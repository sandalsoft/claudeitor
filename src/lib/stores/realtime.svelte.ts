// Real-time data store using SSE for the Readout page.
// Connects to /api/sse, receives typed events, and updates reactive state.
// Implements exponential backoff reconnection on disconnect.
//
// Reconnection strategy: always tear down and create a fresh Source.
// We set cache: false so sveltekit-sse does not reuse stale connections.
//
// Ordering: each event carries a monotonic `seq` number per event type.
// We only apply updates when seq is strictly greater than the last applied,
// avoiding both timestamp ties and stale/out-of-order delivery.

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
	seq: number;
}

function createRealtimeStore() {
	let stats = $state<StatsCache | null>(null);
	let costs = $state<CostCache | null>(null);
	let sessions = $state<SessionEntry[] | null>(null);
	let status = $state<ConnectionStatus>('disconnected');
	let lastEventAt = $state<number | null>(null);

	// Per-type sequence numbers for ordering guard
	let lastStatsSeq = 0;
	let lastCostsSeq = 0;
	let lastSessionsSeq = 0;

	let connection: ReturnType<typeof source> | null = null;
	let storeUnsubscribers: Array<() => void> = [];
	let backoffMs = INITIAL_BACKOFF_MS;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let intentionalClose = false;

	/**
	 * Tear down connection and store subscriptions.
	 * Re-entrancy safe: nulls `connection` before calling close() to
	 * prevent infinite recursion when close() triggers the close callback.
	 */
	function teardownConnection() {
		for (const unsub of storeUnsubscribers) {
			unsub();
		}
		storeUnsubscribers = [];

		const conn = connection;
		connection = null;
		if (conn) {
			conn.close();
		}
	}

	function connect() {
		if (connection) return;

		// Clear any pending reconnect timer to prevent backoff drift:
		// if connect() is called manually while a timer is pending,
		// the timer would fire, no-op, but still increase backoffMs.
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}

		intentionalClose = false;
		status = 'connecting';

		connection = source('/api/sse', {
			open() {
				status = 'connected';
				backoffMs = INITIAL_BACKOFF_MS;
			},
			close() {
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
			cache: false,
			options: {
				method: 'POST'
			}
		});

		// Subscribe to each event type.
		// The server emits full SSEEvent payloads (with type, data, timestamp, seq).
		const statsStore = connection.select('stats-update').json<SSEPayload>();
		const costsStore = connection.select('cost-update').json<SSEPayload>();
		const sessionsStore = connection.select('session-update').json<SSEPayload>();

		// Track unsubscribe functions so we can clean up on disconnect.
		// Ordering guard: only apply if seq is strictly greater than last applied.
		storeUnsubscribers.push(
			statsStore.subscribe((value) => {
				if (value != null && value.seq > lastStatsSeq) {
					lastStatsSeq = value.seq;
					stats = value.data as StatsCache;
					lastEventAt = value.timestamp;
				}
			})
		);

		storeUnsubscribers.push(
			costsStore.subscribe((value) => {
				if (value != null && value.seq > lastCostsSeq) {
					lastCostsSeq = value.seq;
					costs = value.data as CostCache;
					lastEventAt = value.timestamp;
				}
			})
		);

		storeUnsubscribers.push(
			sessionsStore.subscribe((value) => {
				if (value != null && value.seq > lastSessionsSeq) {
					lastSessionsSeq = value.seq;
					sessions = value.data as SessionEntry[];
					lastEventAt = value.timestamp;
				}
			})
		);
	}

	function scheduleReconnect() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
		}

		const delay = backoffMs;
		// Increase backoff now so it's ready for the next failure
		backoffMs = Math.min(backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);

		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			if (intentionalClose) return;
			// connect() will no-op if connection already exists
			connect();
		}, delay);
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
