// Chokidar singleton file watcher for ~/.claude/ data files.
// Uses globalThis to prevent duplicate watchers during HMR reloads.
// Tracks SSE connections via listeners.size: creates watcher on first
// connect, destroys when last disconnects (with idle timeout grace period).
//
// Stale-read protection: a per-file generation counter ensures that
// when rapid file changes overlap async reads, only the latest result
// is emitted -- earlier (stale) reads are silently dropped.
// The generation counter is included in SSE events as a monotonic
// sequence number so clients can order events without timestamp ties.
//
// Note: spec listed src/lib/data/watcher.ts but this file lives in
// src/lib/server/ because it uses Node APIs (chokidar, fs) and must
// be server-only per SvelteKit conventions.

import { watch, type FSWatcher } from 'chokidar';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
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
	/** Monotonically increasing per event type. Used for ordering tiebreaker. */
	seq: number;
}

export type WatcherListener = (event: SSEEvent) => void;

// ─── Watched Files ───────────────────────────────────────────

const WATCHED_FILES = [
	'stats-cache.json',
	'readout-cost-cache.json',
	'history.jsonl'
] as const;

type WatchedFile = (typeof WATCHED_FILES)[number];

const WATCHED_FILE_SET: ReadonlySet<string> = new Set(WATCHED_FILES);

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
	/** Per-file generation counter to drop stale async reads. */
	fileGeneration: Map<WatchedFile, number>;
}

// Idle timeout before destroying watcher after last client disconnects.
const IDLE_TIMEOUT_MS = 30_000;

// globalThis singleton to survive HMR reloads
declare global {
	// eslint-disable-next-line no-var
	var __claudeitorWatcher: WatcherInstance | undefined;
	// eslint-disable-next-line no-var
	var __claudeitorShutdownRegistered: boolean | undefined;
}

function matchWatchedFile(changedPath: string): WatchedFile | null {
	const name = basename(changedPath);
	if (WATCHED_FILE_SET.has(name)) {
		return name as WatchedFile;
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

function formatError(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function emitFileChange(instance: WatcherInstance, changedPath: string): void {
	const file = matchWatchedFile(changedPath);
	if (!file) return;

	// Capture timestamp at event detection time (before async read)
	const timestamp = Date.now();

	// Increment generation for this file to detect stale reads
	const generation = (instance.fileGeneration.get(file) ?? 0) + 1;
	instance.fileGeneration.set(file, generation);

	readFileData(file, instance.claudeDir)
		.then((data) => {
			// Drop stale reads: if generation has advanced, a newer event
			// supersedes this one -- emitting would rewind client state
			if (instance.fileGeneration.get(file) !== generation) return;

			const event: SSEEvent = {
				type: FILE_TO_EVENT[file],
				data,
				timestamp,
				seq: generation
			};

			for (const listener of instance.listeners) {
				try {
					listener(event);
				} catch (err) {
					console.warn('[watcher] Listener error:', formatError(err));
				}
			}
		})
		.catch((err: unknown) => {
			console.warn(`[watcher] Failed to read ${file} after change:`, formatError(err));
		});
}

function createWatcherInstance(claudeDir: string): WatcherInstance {
	// Verify the directory exists before setting up the watcher.
	// Log a clear warning so "SSE connected but never updates" is diagnosable.
	if (!existsSync(claudeDir)) {
		console.warn(`[watcher] Directory does not exist: ${claudeDir} -- file watching will not produce events until it is created`);
	}

	// Watch the directory and filter events by basename. This is more
	// robust than watching individual file paths because atomic writes
	// (write temp + rename) and file recreation are handled consistently.
	const fsWatcher = watch(claudeDir, {
		persistent: true,
		ignoreInitial: true,
		depth: 0,
		awaitWriteFinish: {
			stabilityThreshold: 500,
			pollInterval: 100
		}
	});

	const instance: WatcherInstance = {
		watcher: fsWatcher,
		listeners: new Set(),
		idleTimer: null,
		claudeDir,
		fileGeneration: new Map()
	};

	// Handle 'change', 'add', and 'unlink' events:
	// - 'change': normal file modification
	// - 'add': atomic write patterns (write temp + rename) and new files
	// - 'unlink': file deletion (readers return empty defaults on ENOENT)
	// matchWatchedFile() filters to only our target files.
	const handleFileEvent = (changedPath: string) => emitFileChange(instance, changedPath);
	fsWatcher.on('change', handleFileEvent);
	fsWatcher.on('add', handleFileEvent);
	fsWatcher.on('unlink', handleFileEvent);

	fsWatcher.on('error', (err: unknown) => {
		console.warn('[watcher] Chokidar error:', formatError(err));
	});

	console.log('[watcher] Created singleton file watcher for', claudeDir);
	return instance;
}

function registerShutdownHooks(): void {
	if (globalThis.__claudeitorShutdownRegistered) return;
	globalThis.__claudeitorShutdownRegistered = true;

	const shutdown = () => {
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
 */
export function subscribe(
	listener: WatcherListener,
	claudeDir = join(homedir(), '.claude')
): () => void {
	const instance = ensureInstance(claudeDir);

	if (instance.idleTimer) {
		clearTimeout(instance.idleTimer);
		instance.idleTimer = null;
	}

	instance.listeners.add(listener);

	let unsubscribed = false;

	return () => {
		if (unsubscribed) return;
		unsubscribed = true;

		instance.listeners.delete(listener);

		if (instance.listeners.size === 0) {
			instance.idleTimer = setTimeout(async () => {
				// destroyWatcher re-checks listeners.size internally
				await destroyWatcher();
			}, IDLE_TIMEOUT_MS);
		}
	};
}

/**
 * Destroy the singleton watcher. Called on server shutdown or idle timeout.
 * Bails if listeners have been added since the destroy was scheduled.
 *
 * Atomicity: we clear the globalThis reference synchronously *before* the
 * async watcher.close(). This means any new subscriber arriving during the
 * close will see no existing instance and create a fresh one, rather than
 * attaching to a watcher that is mid-destruction.
 */
export async function destroyWatcher(): Promise<void> {
	const instance = globalThis.__claudeitorWatcher;
	if (!instance) return;

	// Race guard: a new subscriber may have been added between when
	// the idle timeout fired and when this function executes.
	if (instance.listeners.size > 0) return;

	if (instance.idleTimer) {
		clearTimeout(instance.idleTimer);
		instance.idleTimer = null;
	}

	// Clear the singleton reference synchronously so new subscribers
	// arriving during the async close() create a fresh instance.
	globalThis.__claudeitorWatcher = undefined;

	instance.listeners.clear();

	try {
		await instance.watcher.close();
		console.log('[watcher] Destroyed singleton file watcher');
	} catch (err) {
		console.warn('[watcher] Error closing watcher:', formatError(err));
	}
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
