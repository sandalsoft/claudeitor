// Real-time data store using SSE for the Readout page.
// Connects to /api/sse, receives typed events, and updates reactive state.
// Implements exponential backoff reconnection on disconnect.

import { source } from 'sveltekit-sse';
import type { StatsCache, CostCache, SessionEntry } from '../data/types.js';

// ─── Connection State ────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ─── Backoff Configuration ───────────────────────────────────

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

// ─── Store ───────────────────────────────────────────────────

function createRealtimeStore() {
	let stats = $state<StatsCache | null>(null);
	let costs = $state<CostCache | null>(null);
	let sessions = $state<SessionEntry[] | null>(null);
	let status = $state<ConnectionStatus>('disconnected');
	let lastEventAt = $state<number | null>(null);

	let connection: ReturnType<typeof source> | null = null;
	let backoffMs = INITIAL_BACKOFF_MS;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let intentionalClose = false;

	function connect() {
		if (connection) return;

		intentionalClose = false;
		status = 'connecting';

		connection = source('/api/sse', {
			open() {
				status = 'connected';
				backoffMs = INITIAL_BACKOFF_MS;
			},
			close({ connect: reconnect }) {
				connection = null;
				if (intentionalClose) {
					status = 'disconnected';
					return;
				}

				status = 'error';
				scheduleReconnect(reconnect);
			},
			error() {
				connection = null;
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

		// Subscribe to each event type
		const statsStore = connection.select('stats-update').json<StatsCache>();
		const costsStore = connection.select('cost-update').json<CostCache>();
		const sessionsStore = connection.select('session-update').json<SessionEntry[]>();

		// sveltekit-sse returns Svelte readable stores -- subscribe to them
		statsStore.subscribe((value) => {
			if (value != null) {
				stats = value;
				lastEventAt = Date.now();
			}
		});

		costsStore.subscribe((value) => {
			if (value != null) {
				costs = value;
				lastEventAt = Date.now();
			}
		});

		sessionsStore.subscribe((value) => {
			if (value != null) {
				sessions = value;
				lastEventAt = Date.now();
			}
		});
	}

	function scheduleReconnect(reconnectFn?: () => void) {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
		}

		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			if (intentionalClose) return;

			if (reconnectFn) {
				reconnectFn();
			} else {
				connection = null;
				connect();
			}

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

		if (connection) {
			connection.close();
			connection = null;
		}

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
