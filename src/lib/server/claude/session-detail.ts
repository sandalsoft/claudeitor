/**
 * Session detail reader: parses individual session JSONL files to extract
 * conversation messages, metadata, and best-effort file diffs.
 *
 * Session files live at ~/.claude/projects/<encoded-path>/<sessionId>.jsonl
 * and can be 4MB+, so we stream line-by-line rather than loading all at once.
 */

import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

// ─── Types ───────────────────────────────────────────────────────

export interface SessionMessage {
	role: 'user' | 'assistant' | 'system';
	timestamp: string;
	text: string;
	model?: string;
	toolCalls?: ToolCallInfo[];
	tokens?: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
	};
}

export interface ToolCallInfo {
	name: string;
	/** Best-effort file path if tool involves a file. */
	filePath?: string;
	/** Best-effort diff content. Null if reconstruction failed. */
	diff?: string | null;
}

export interface SessionMetadata {
	sessionId: string;
	project?: string;
	startTime: string;
	endTime: string;
	durationMs: number;
	model: string;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCacheReadTokens: number;
	totalCacheWriteTokens: number;
	messageCount: number;
	toolCallCount: number;
	filesModified: string[];
	version?: string;
	gitBranch?: string;
}

export interface SessionDetail {
	metadata: SessionMetadata;
	messages: SessionMessage[];
}

// ─── Path encoding ───────────────────────────────────────────────

/**
 * Encode a filesystem path into Claude's project directory name format.
 * Replaces / with - and prepends -.
 */
export function encodeProjectPath(projectPath: string): string {
	return '-' + projectPath.replace(/\//g, '-');
}

// ─── Session file discovery ──────────────────────────────────────

/**
 * Find the JSONL file for a given session ID by searching all project dirs.
 * Returns the full path and project directory name, or null if not found.
 */
export async function findSessionFile(
	sessionId: string,
	claudeDir = DEFAULT_CLAUDE_DIR
): Promise<{ filePath: string; projectDir: string } | null> {
	const projectsDir = join(claudeDir, 'projects');

	try {
		const dirs = await readdir(projectsDir);

		for (const dir of dirs) {
			const candidate = join(projectsDir, dir, `${sessionId}.jsonl`);
			try {
				await stat(candidate);
				return { filePath: candidate, projectDir: dir };
			} catch {
				// Not in this directory, continue
			}
		}
	} catch {
		// projects directory doesn't exist
	}

	return null;
}

// ─── JSONL streaming parser ──────────────────────────────────────

/**
 * Parse a session JSONL file into structured messages and metadata.
 * Uses line-by-line streaming to handle large files (4MB+).
 */
export async function readSessionDetail(
	sessionId: string,
	claudeDir = DEFAULT_CLAUDE_DIR
): Promise<SessionDetail | null> {
	const found = await findSessionFile(sessionId, claudeDir);
	if (!found) return null;

	const messages: SessionMessage[] = [];
	let firstTimestamp = '';
	let lastTimestamp = '';
	let model = '';
	let version = '';
	let gitBranch = '';
	let project = '';
	let totalInputTokens = 0;
	let totalOutputTokens = 0;
	let totalCacheReadTokens = 0;
	let totalCacheWriteTokens = 0;
	let toolCallCount = 0;
	const filesModifiedSet = new Set<string>();

	const rl = createInterface({
		input: createReadStream(found.filePath, { encoding: 'utf-8' }),
		crlfDelay: Infinity
	});

	for await (const line of rl) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		let entry: Record<string, unknown>;
		try {
			entry = JSON.parse(trimmed);
		} catch {
			continue; // Skip malformed lines
		}

		const type = entry.type as string | undefined;
		const ts = entry.timestamp as string | undefined;

		if (ts) {
			if (!firstTimestamp) firstTimestamp = ts;
			lastTimestamp = ts;
		}

		// Extract project from cwd field
		if (!project && entry.cwd) {
			project = entry.cwd as string;
		}

		// Extract version and branch
		if (!version && entry.version) version = entry.version as string;
		if (!gitBranch && entry.gitBranch) gitBranch = entry.gitBranch as string;

		if (type === 'user') {
			const message = entry.message as Record<string, unknown> | undefined;
			if (message) {
				const content = message.content;
				let text = '';
				if (typeof content === 'string') {
					text = content;
				} else if (Array.isArray(content)) {
					text = content
						.filter((b: Record<string, unknown>) => b.type === 'text')
						.map((b: Record<string, unknown>) => b.text as string)
						.join('\n');
				}
				if (text) {
					messages.push({
						role: 'user',
						timestamp: ts ?? '',
						text
					});
				}
			}
		} else if (type === 'assistant') {
			const message = entry.message as Record<string, unknown> | undefined;
			if (message) {
				// Extract model
				const msgModel = message.model as string | undefined;
				if (msgModel && !model) model = msgModel;

				// Extract tokens
				const usage = message.usage as Record<string, number> | undefined;
				if (usage) {
					totalInputTokens += usage.input_tokens ?? 0;
					totalOutputTokens += usage.output_tokens ?? 0;
					totalCacheReadTokens += usage.cache_read_input_tokens ?? 0;
					totalCacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
				}

				// Extract text + tool calls
				const content = message.content;
				const toolCalls: ToolCallInfo[] = [];
				let text = '';

				if (Array.isArray(content)) {
					for (const block of content) {
						const blockObj = block as Record<string, unknown>;
						if (blockObj.type === 'text') {
							text += (text ? '\n' : '') + (blockObj.text as string);
						} else if (blockObj.type === 'tool_use') {
							toolCallCount++;
							const toolName = blockObj.name as string;
							const input = blockObj.input as Record<string, unknown> | undefined;
							const toolInfo: ToolCallInfo = { name: toolName };

							// Best-effort file path extraction
							if (input) {
								const filePath =
									(input.file_path as string) ??
									(input.path as string) ??
									(input.filePath as string) ??
									(input.notebook_path as string);
								if (filePath) {
									toolInfo.filePath = filePath;
									filesModifiedSet.add(filePath);
								}

								// Best-effort diff for Edit tool
								if (toolName === 'Edit' || toolName === 'write') {
									const oldStr = input.old_string as string | undefined;
									const newStr = input.new_string as string | undefined;
									if (oldStr !== undefined && newStr !== undefined) {
										toolInfo.diff = formatSimpleDiff(oldStr, newStr);
									} else if (input.content) {
										toolInfo.diff = null; // File write, no diff
									}
								}
							}

							toolCalls.push(toolInfo);
						}
					}
				}

				if (text || toolCalls.length > 0) {
					messages.push({
						role: 'assistant',
						timestamp: ts ?? '',
						text,
						model: msgModel,
						toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
						tokens: usage
							? {
									input: usage.input_tokens ?? 0,
									output: usage.output_tokens ?? 0,
									cacheRead: usage.cache_read_input_tokens ?? 0,
									cacheWrite: usage.cache_creation_input_tokens ?? 0
								}
							: undefined
					});
				}
			}
		}
	}

	const startTime = firstTimestamp || new Date().toISOString();
	const endTime = lastTimestamp || startTime;
	const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();

	return {
		metadata: {
			sessionId,
			project: project || undefined,
			startTime,
			endTime,
			durationMs: Math.max(0, durationMs),
			model: model || 'unknown',
			totalInputTokens,
			totalOutputTokens,
			totalCacheReadTokens,
			totalCacheWriteTokens,
			messageCount: messages.length,
			toolCallCount,
			filesModified: [...filesModifiedSet],
			version: version || undefined,
			gitBranch: gitBranch || undefined
		},
		messages
	};
}

// ─── AI Summary ──────────────────────────────────────────────────

export interface AISummary {
	summary: string;
	generatedAt: string;
	model: string;
}

/**
 * Get cached AI summary path for a session in its project dir.
 */
function summaryPath(sessionId: string, projectDir: string, claudeDir: string): string {
	return join(claudeDir, 'projects', projectDir, 'claudeitor-cache', `summary-${sessionId}.json`);
}

/**
 * Read a cached AI summary for a session. Returns null if not cached.
 */
export async function readCachedSummary(
	sessionId: string,
	claudeDir = DEFAULT_CLAUDE_DIR
): Promise<AISummary | null> {
	const found = await findSessionFile(sessionId, claudeDir);
	if (!found) return null;

	const cachePath = summaryPath(sessionId, found.projectDir, claudeDir);
	try {
		const raw = await readFile(cachePath, 'utf-8');
		return JSON.parse(raw) as AISummary;
	} catch {
		return null;
	}
}

/**
 * Cache an AI summary for a session.
 */
export async function cacheSummary(
	sessionId: string,
	summary: AISummary,
	claudeDir = DEFAULT_CLAUDE_DIR
): Promise<void> {
	const found = await findSessionFile(sessionId, claudeDir);
	if (!found) return;

	const cachePath = summaryPath(sessionId, found.projectDir, claudeDir);
	const cacheDir = join(claudeDir, 'projects', found.projectDir, 'claudeitor-cache');

	await mkdir(cacheDir, { recursive: true });
	await writeFile(cachePath, JSON.stringify(summary, null, 2), 'utf-8');
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Format a simple inline diff from old_string -> new_string.
 * Returns a unified-diff-style string for display.
 */
function formatSimpleDiff(oldStr: string, newStr: string): string {
	const oldLines = oldStr.split('\n');
	const newLines = newStr.split('\n');

	const lines: string[] = [];
	const maxLen = Math.max(oldLines.length, newLines.length);

	for (let i = 0; i < maxLen; i++) {
		if (i < oldLines.length && i < newLines.length) {
			if (oldLines[i] !== newLines[i]) {
				lines.push(`- ${oldLines[i]}`);
				lines.push(`+ ${newLines[i]}`);
			} else {
				lines.push(`  ${oldLines[i]}`);
			}
		} else if (i < oldLines.length) {
			lines.push(`- ${oldLines[i]}`);
		} else {
			lines.push(`+ ${newLines[i]}`);
		}
	}

	return lines.join('\n');
}

/**
 * Format duration in milliseconds as a human-readable string.
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) return '<1s';
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${hours}h ${remainingMinutes}m`;
}
