// Chokidar singleton file watcher for ~/.claude/ data files.
// Uses globalThis to prevent duplicate watchers during HMR reloads.
// Tracks SSE connections via listeners.size: creates watcher on first
// connect, destroys when last disconnects (with idle timeout grace period).

import { watch, type FSWatcher } from 'chokidar';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readStatsCache } from './claude/stats.js';
import { readCostCache } from './claude/costs.js';
import { readSessionHistory } from './claude/sessions.js';
import type { StatsCache, CostCache, SessionEntry } from '../data/types.js';

// ─── SSE Event Types ─────────────────────────────────────────

export type SSEEventType = 'stats-update' | 'cost-update' | 'session-update';

export interface SSEEvent {
	type: SSEEventType;
	data: StatsCache | CostCache | SessionEntry[];
	timestamp: number;
}

export type WatcherListener = (event: SSEEvent) => void;

// ─── Watched Files ───────────────────────────────────────────

const WATCHED_FILES = [
	'stats-cache.json',
	'readout-cost-cache.json',
	'history.jsonl'
] as const;

type WatchedFile = (typeof WATCHED_FILES)[number];

const FILE_TO_EVENT: Record<WatchedFile, SSEEventType> = {
	'stats-cache.json': 'stats-update',
	'readout-cost-cache.json': 'cost-update',
	'history.jsonl': 'session-update'
};

// ─── Watcher Instance ────────────────────────────────────────

interface WatcherInstance {
	watcher: FSWatcher;
	listeners: Set<WatcherListener>;
	idleTimer: ReturnType<typeof setTimeout> | null;
	claudeDir: string;
}

// Idle timeout before destroying watcher after last client disconnects.
// Gives time for page reloads without tearing down/recreating the watcher.
const IDLE_TIMEOUT_MS = 30_000;

// globalThis singleton to survive HMR reloads
declare global {
	// eslint-disable-next-line no-var
	var __claudeitorWatcher: WatcherInstance | undefined;
	// eslint-disable-next-line no-var
	var __claudeitorShutdownRegistered: boolean | undefined;
}

function getWatchedFilePath(changedPath: string): WatchedFile | null {
	for (const file of WATCHED_FILES) {
		if (changedPath.endsWith(file)) {
			return file;
		}
	}
	return null;
}

function assertNever(value: never): never {
	throw new Error(`[watcher] Unexpected watched file: ${String(value)}`);
}

async function readFileData(
	file: WatchedFile,
	claudeDir: string
): Promise<StatsCache | CostCache | SessionEntry[]> {
	switch (file) {
		case 'stats-cache.json':
			return readStatsCache(claudeDir);
		case 'readout-cost-cache.json':
			return readCostCache(claudeDir);
		case 'history.jsonl':
			return readSessionHistory(claudeDir);
		default:
			return assertNever(file);
	}
}

function emitFileChange(instance: WatcherInstance, changedPath: string): void {
	const file = getWatchedFilePath(changedPath);
	if (!file) return;

	// Fire-and-forget: read file and notify listeners
	readFileData(file, instance.claudeDir)
		.then((data) => {
			const event: SSEEvent = {
				type: FILE_TO_EVENT[file],
				data,
				timestamp: Date.now()
			};

			for (const listener of instance.listeners) {
				try {
					listener(event);
				} catch (err) {
					console.warn('[watcher] Listener error:', (err as Error).message);
				}
			}
		})
		.catch((err: unknown) => {
			console.warn(
				`[watcher] Failed to read ${file} after change:`,
				err instanceof Error ? err.message : String(err)
			);
		});
}

function createWatcherInstance(claudeDir: string): WatcherInstance {
	const watchPaths = WATCHED_FILES.map((f) => join(claudeDir, f));

	const fsWatcher = watch(watchPaths, {
		persistent: true,
		ignoreInitial: true,
		awaitWriteFinish: {
			stabilityThreshold: 500,
			pollInterval: 100
		}
	});

	const instance: WatcherInstance = {
		watcher: fsWatcher,
		listeners: new Set(),
		idleTimer: null,
		claudeDir
	};

	// Handle both 'change' and 'add' events. Atomic write patterns
	// (write temp + rename) surface as 'add' rather than 'change',
	// and files created after startup also emit 'add'.
	const handleFileEvent = (changedPath: string) => emitFileChange(instance, changedPath);
	fsWatcher.on('change', handleFileEvent);
	fsWatcher.on('add', handleFileEvent);

	fsWatcher.on('error', (err: unknown) => {
		console.warn('[watcher] Chokidar error:', err instanceof Error ? err.message : String(err));
	});

	console.log('[watcher] Created singleton file watcher for', claudeDir);
	return instance;
}

function registerShutdownHooks(): void {
	if (globalThis.__claudeitorShutdownRegistered) return;
	globalThis.__claudeitorShutdownRegistered = true;

	const shutdown = () => {
		// Synchronous-safe: destroyWatcher is async but process may exit before it completes.
		// Best effort cleanup.
		const instance = globalThis.__claudeitorWatcher;
		if (instance) {
			instance.listeners.clear();
			instance.watcher.close().catch(() => {
				// Swallow errors during shutdown
			});
			globalThis.__claudeitorWatcher = undefined;
			console.log('[watcher] Cleaned up on process shutdown');
		}
	};

	process.once('SIGTERM', shutdown);
	process.once('SIGINT', shutdown);
	process.once('beforeExit', shutdown);
}

function ensureInstance(claudeDir: string): WatcherInstance {
	const existing = globalThis.__claudeitorWatcher;
	if (existing) {
		// Warn if called with a different directory than the active watcher
		if (existing.claudeDir !== claudeDir) {
			console.warn(
				`[watcher] Singleton already watching "${existing.claudeDir}", ignoring request for "${claudeDir}"`
			);
		}
		return existing;
	}

	registerShutdownHooks();
	globalThis.__claudeitorWatcher = createWatcherInstance(claudeDir);
	return globalThis.__claudeitorWatcher;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Subscribe to file change events. Returns an unsubscribe function.
 * Creates the watcher on first subscription, destroys after idle timeout
 * when all subscribers disconnect.
 *
 * Connection tracking uses listeners.size directly (no separate refCount)
 * to avoid divergence between Set membership and counter.
 */
export function subscribe(
	listener: WatcherListener,
	claudeDir = join(homedir(), '.claude')
): () => void {
	const instance = ensureInstance(claudeDir);

	// Cancel any pending idle shutdown
	if (instance.idleTimer) {
		clearTimeout(instance.idleTimer);
		instance.idleTimer = null;
	}

	instance.listeners.add(listener);

	// Guard against double-unsubscribe
	let unsubscribed = false;

	return () => {
		if (unsubscribed) return;
		unsubscribed = true;

		instance.listeners.delete(listener);

		if (instance.listeners.size === 0) {
			// Start idle timer -- don't tear down immediately in case of page reload
			instance.idleTimer = setTimeout(async () => {
				if (instance.listeners.size === 0) {
					await destroyWatcher();
				}
			}, IDLE_TIMEOUT_MS);
		}
	};
}

/**
 * Destroy the singleton watcher. Called on server shutdown.
 */
export async function destroyWatcher(): Promise<void> {
	const instance = globalThis.__claudeitorWatcher;
	if (!instance) return;

	if (instance.idleTimer) {
		clearTimeout(instance.idleTimer);
		instance.idleTimer = null;
	}

	instance.listeners.clear();

	try {
		await instance.watcher.close();
		console.log('[watcher] Destroyed singleton file watcher');
	} catch (err) {
		console.warn('[watcher] Error closing watcher:', (err as Error).message);
	}

	// Always clear -- a failed close means the watcher is in a bad state
	// and keeping the reference would prevent creating a fresh one
	globalThis.__claudeitorWatcher = undefined;
}

/**
 * Get current watcher stats (for debugging/monitoring).
 */
export function getWatcherStats(): {
	active: boolean;
	listenerCount: number;
	idleTimerPending: boolean;
} {
	const instance = globalThis.__claudeitorWatcher;
	if (!instance) {
		return { active: false, listenerCount: 0, idleTimerPending: false };
	}
	return {
		active: true,
		listenerCount: instance.listeners.size,
		idleTimerPending: instance.idleTimer !== null
	};
}
