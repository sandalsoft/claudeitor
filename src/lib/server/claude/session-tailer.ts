/**
 * Incremental JSONL tailer for live session telemetry.
 *
 * Reads active session files efficiently by tracking byte offsets. On each
 * invocation, reads only new bytes appended since the last call. Maintains
 * cumulative state per session: total token counts, recent tool calls
 * (correlated via tool_use_id), and recent file mutations.
 *
 * The module-level `sessionTailer` singleton is created via the
 * `createSessionTailer()` factory. It MUST persist across HTTP requests
 * within a server process so cumulative state (byte offsets, token totals)
 * survives between poll cycles. This is intentional — not an accidental
 * module-level mutable default.
 */

import { open, stat } from 'node:fs/promises';
import type { LiveSessionTelemetry, LiveToolCall, LiveFileMutation } from '../../data/types.js';
import { findSessionFile } from './session-detail.js';
import { warn } from '../telemetry/logger.js';

const MODULE = 'session-tailer';

// ─── Constants ──────────────────────────────────────────────────

const MAX_TOOL_CALLS = 50;
const MAX_FILE_MUTATIONS = 30;
const EVICTION_MS = 5 * 60 * 1000; // 5 minutes

/** Tool names that touch files (matched case-insensitively). */
const FILE_TOOLS = new Set(['edit', 'multiedit', 'write', 'read', 'notebookedit']);

/** Input keys that may contain file paths, checked in priority order. */
const PATH_KEYS = ['file_path', 'path', 'filePath', 'notebook_path'] as const;

/** Map tool names (lowercase) to semantic operations. */
const TOOL_OPERATIONS: Record<string, LiveFileMutation['operation']> = {
	edit: 'edit',
	multiedit: 'edit',
	write: 'write',
	read: 'read',
	notebookedit: 'notebook_edit'
};

// ─── Internal state ─────────────────────────────────────────────

interface PendingToolCall {
	id: string;
	name: string;
	filePath?: string;
	timestamp: string;
}

interface SessionTailState {
	byteOffset: number;
	lastPolledAt: number;
	/** Trailing partial line buffered for the next read. */
	trailingPartial: string;
	/** Cumulative token counts. */
	tokens: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
	};
	recentToolCalls: LiveToolCall[];
	recentFiles: LiveFileMutation[];
	/** Pending tool_use blocks awaiting their tool_result. Keyed by tool_use id. */
	pendingToolCalls: Map<string, PendingToolCall>;
	model: string;
	messageCount: number;
}

// ─── Factory ────────────────────────────────────────────────────

export interface SessionTailer {
	/**
	 * Tail new bytes from the session's JSONL file, update cumulative state,
	 * and return the current telemetry snapshot.
	 */
	tail(sessionId: string, claudeDir?: string): Promise<LiveSessionTelemetry>;

	/** Reset state for a single session (e.g. when session ends). */
	reset(sessionId: string): void;

	/** Reset all session state. */
	resetAll(): void;
}

/**
 * Create a new SessionTailer instance with its own internal state map.
 * Use the module-level `sessionTailer` singleton for production;
 * call this directly only in tests to get isolated instances.
 */
export function createSessionTailer(): SessionTailer {
	const sessions = new Map<string, SessionTailState>();

	function freshState(): SessionTailState {
		return {
			byteOffset: 0,
			lastPolledAt: Date.now(),
			trailingPartial: '',
			tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			recentToolCalls: [],
			recentFiles: [],
			pendingToolCalls: new Map(),
			model: '',
			messageCount: 0
		};
	}

	/** Evict sessions that have not been polled for EVICTION_MS. */
	function evictStale(): void {
		const cutoff = Date.now() - EVICTION_MS;
		for (const [id, state] of sessions) {
			if (state.lastPolledAt < cutoff) {
				sessions.delete(id);
			}
		}
	}

	/** Push a tool call, capping at MAX_TOOL_CALLS. */
	function pushToolCall(state: SessionTailState, call: LiveToolCall): void {
		state.recentToolCalls.push(call);
		if (state.recentToolCalls.length > MAX_TOOL_CALLS) {
			state.recentToolCalls = state.recentToolCalls.slice(-MAX_TOOL_CALLS);
		}
	}

	/** Push a file mutation, capping at MAX_FILE_MUTATIONS. */
	function pushFileMutation(state: SessionTailState, mutation: LiveFileMutation): void {
		state.recentFiles.push(mutation);
		if (state.recentFiles.length > MAX_FILE_MUTATIONS) {
			state.recentFiles = state.recentFiles.slice(-MAX_FILE_MUTATIONS);
		}
	}

	/**
	 * Extract a file path from a tool_use input object.
	 * Returns undefined if no recognizable path key is found.
	 */
	function extractFilePath(input: Record<string, unknown> | undefined): string | undefined {
		if (!input) return undefined;
		for (const key of PATH_KEYS) {
			const val = input[key];
			if (typeof val === 'string' && val) return val;
		}
		return undefined;
	}

	/**
	 * Process parsed JSONL lines, updating cumulative state.
	 */
	function processLines(state: SessionTailState, lines: string[]): void {
		for (const raw of lines) {
			const trimmed = raw.trim();
			if (!trimmed) continue;

			let entry: Record<string, unknown>;
			try {
				entry = JSON.parse(trimmed);
			} catch {
				warn(MODULE, 'Malformed JSON line in session JSONL, skipping', {
					preview: trimmed.slice(0, 80)
				});
				continue;
			}

			const type = entry.type as string | undefined;
			const ts = (entry.timestamp as string) ?? '';

			if (type === 'assistant') {
				state.messageCount++;
				const message = entry.message as Record<string, unknown> | undefined;
				if (!message) continue;

				// Model
				const msgModel = message.model as string | undefined;
				if (msgModel) state.model = msgModel;

				// Tokens (cumulative)
				const usage = message.usage as Record<string, number> | undefined;
				if (usage) {
					state.tokens.input += usage.input_tokens ?? 0;
					state.tokens.output += usage.output_tokens ?? 0;
					state.tokens.cacheRead += usage.cache_read_input_tokens ?? 0;
					state.tokens.cacheWrite += usage.cache_creation_input_tokens ?? 0;
				}

				// Content blocks: tool_use and tool_result
				const content = message.content;
				if (Array.isArray(content)) {
					for (const block of content) {
						const b = block as Record<string, unknown>;
						if (b.type === 'tool_use') {
							const toolId = b.id as string;
							const toolName = b.name as string;
							const input = b.input as Record<string, unknown> | undefined;
							const filePath = extractFilePath(input);

							// Track as pending
							state.pendingToolCalls.set(toolId, {
								id: toolId,
								name: toolName,
								filePath,
								timestamp: ts
							});

							// Add as pending tool call to recent list
							pushToolCall(state, {
								id: toolId,
								name: toolName,
								status: 'pending',
								filePath,
								timestamp: ts
							});

							// File mutation extraction (case-insensitive, exclude Bash)
							const toolNameLower = toolName.toLowerCase();
							if (FILE_TOOLS.has(toolNameLower) && filePath) {
								pushFileMutation(state, {
									filePath,
									toolName,
									operation: TOOL_OPERATIONS[toolNameLower] ?? 'other',
									timestamp: ts
								});
							}
						} else if (b.type === 'tool_result') {
							const toolUseId = b.tool_use_id as string;
							const isError = !!b.is_error;
							const pending = state.pendingToolCalls.get(toolUseId);
							if (pending) {
								state.pendingToolCalls.delete(toolUseId);
								// Update the matching tool call entry in recentToolCalls
								for (let i = state.recentToolCalls.length - 1; i >= 0; i--) {
									if (
										state.recentToolCalls[i].id === toolUseId &&
										state.recentToolCalls[i].status === 'pending'
									) {
										state.recentToolCalls[i] = {
											...state.recentToolCalls[i],
											status: isError ? 'error' : 'success'
										};
										break;
									}
								}
							}
						}
					}
				}
			} else if (type === 'user') {
				state.messageCount++;
			}
		}
	}

	async function tail(sessionId: string, claudeDir?: string): Promise<LiveSessionTelemetry> {
		evictStale();

		let state = sessions.get(sessionId);
		if (!state) {
			state = freshState();
			sessions.set(sessionId, state);
		}
		state.lastPolledAt = Date.now();

		// Locate the session file
		const found = await findSessionFile(sessionId, claudeDir);
		if (!found) {
			return snapshot(state);
		}

		// Check file size for truncation detection
		let fileInfo;
		try {
			fileInfo = await stat(found.filePath);
		} catch {
			return snapshot(state);
		}

		const fileSize = fileInfo.size;

		// File truncated or rotated: reset state
		if (state.byteOffset > fileSize) {
			const resetState = freshState();
			resetState.lastPolledAt = state.lastPolledAt;
			sessions.set(sessionId, resetState);
			state = resetState;
		}

		// No new data
		if (state.byteOffset >= fileSize) {
			return snapshot(state);
		}

		// Read only the new bytes
		const bytesToRead = fileSize - state.byteOffset;
		const buffer = Buffer.alloc(bytesToRead);
		let fd;
		try {
			fd = await open(found.filePath, 'r');
			await fd.read(buffer, 0, bytesToRead, state.byteOffset);
		} catch {
			return snapshot(state);
		} finally {
			if (fd) await fd.close();
		}

		// Prepend any trailing partial line from the last read
		const chunk = state.trailingPartial + buffer.toString('utf-8');

		// Split into lines. The last element may be a partial line
		// if the file was still being written.
		const rawLines = chunk.split('\n');

		// If the chunk does NOT end with a newline, the last "line" is partial.
		// Buffer it for the next read.
		if (!chunk.endsWith('\n')) {
			state.trailingPartial = rawLines.pop() ?? '';
		} else {
			state.trailingPartial = '';
			// Remove the empty string after the trailing newline
			if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
				rawLines.pop();
			}
		}

		processLines(state, rawLines);
		state.byteOffset = fileSize;

		return snapshot(state);
	}

	function snapshot(state: SessionTailState): LiveSessionTelemetry {
		return {
			tokens: { ...state.tokens },
			recentToolCalls: [...state.recentToolCalls],
			recentFiles: [...state.recentFiles],
			messageCount: state.messageCount,
			model: state.model
		};
	}

	function reset(sessionId: string): void {
		sessions.delete(sessionId);
	}

	function resetAll(): void {
		sessions.clear();
	}

	return { tail, reset, resetAll };
}

// ─── Module-level singleton ─────────────────────────────────────
//
// This singleton persists across HTTP requests within the SvelteKit
// server process. It is created via factory to satisfy the "no
// module-level mutable defaults" convention — the factory call is
// the one deliberate exception since the tailer MUST keep cumulative
// state (byte offsets, token totals) alive between poll cycles.

export const sessionTailer: SessionTailer = createSessionTailer();
