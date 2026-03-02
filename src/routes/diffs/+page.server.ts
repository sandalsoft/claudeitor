import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { readSessionHistory } from '$lib/server/claude/sessions';
import { findSessionFile } from '$lib/server/claude/session-detail';
import { withSpan } from '$lib/server/telemetry/span-helpers';
import { warn } from '$lib/server/telemetry/logger';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { SessionDiff, FileMutation } from '$lib/data/types';

/**
 * Parse a single JSONL line from a session file, extracting any file mutation.
 * Returns null if the line does not contain a tool_use block that modifies a file.
 */
function parseMutationFromLine(line: string): FileMutation | null {
	const trimmed = line.trim();
	if (!trimmed) return null;

	let entry: Record<string, unknown>;
	try {
		entry = JSON.parse(trimmed);
	} catch {
		return null;
	}

	if (entry.type !== 'assistant') return null;

	const message = entry.message as Record<string, unknown> | undefined;
	if (!message) return null;

	const content = message.content;
	if (!Array.isArray(content)) return null;

	// Find the first tool_use block that modifies a file
	for (const block of content) {
		const blockObj = block as Record<string, unknown>;
		if (blockObj.type !== 'tool_use') continue;

		const toolName = blockObj.name as string;
		const input = blockObj.input as Record<string, unknown> | undefined;
		if (!input) continue;

		const filePath =
			(input.file_path as string) ??
			(input.path as string) ??
			(input.filePath as string) ??
			(input.notebook_path as string);

		if (!filePath) continue;

		// Only include tools that modify files
		if (toolName === 'Edit' || toolName === 'write' || toolName === 'Write' || toolName === 'NotebookEdit') {
			let diff: string | null = null;

			if (toolName === 'Edit') {
				const oldStr = input.old_string as string | undefined;
				const newStr = input.new_string as string | undefined;
				if (oldStr !== undefined && newStr !== undefined) {
					diff = formatSimpleDiff(oldStr, newStr);
				}
			}

			return { filePath, tool: toolName, diff };
		}
	}

	return null;
}

/**
 * Format a simple inline diff from old_string -> new_string.
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
 * Stream-parse a session JSONL file for file mutations.
 */
async function extractMutations(sessionFilePath: string): Promise<FileMutation[]> {
	const mutations: FileMutation[] = [];

	try {
		const rl = createInterface({
			input: createReadStream(sessionFilePath, { encoding: 'utf-8' }),
			crlfDelay: Infinity
		});

		for await (const line of rl) {
			const mutation = parseMutationFromLine(line);
			if (mutation) {
				mutations.push(mutation);
			}
		}
	} catch (err) {
		warn('diffs', `Failed to parse session file: ${sessionFilePath}`, {
			'error.type': (err as Error).name
		});
	}

	return mutations;
}

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:diffs',
		{
			'code.filepath': 'src/routes/diffs/+page.server.ts',
			'http.route': '/diffs'
		},
		async () => {
			const config = await readConfig();
			const sessions = await readSessionHistory(config.claudeDir);

			// Sort by timestamp desc, take 50
			const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);

			const diffs: SessionDiff[] = [];

			for (const session of sorted) {
				// Locate the session JSONL file
				const sessionId = session.sessionId;
				if (!sessionId) continue;

				const found = await findSessionFile(sessionId, config.claudeDir);
				if (!found) continue;

				const mutations = await extractMutations(found.filePath);

				diffs.push({
					display: session.display,
					timestamp: session.timestamp,
					project: session.project,
					sessionId,
					mutations
				});
			}

			// Summary stats
			const totalMutations = diffs.reduce((sum, d) => sum + d.mutations.length, 0);
			const uniqueFiles = new Set(diffs.flatMap((d) => d.mutations.map((m) => m.filePath)));

			return {
				diffs,
				totalSessions: diffs.length,
				totalMutations,
				uniqueFileCount: uniqueFiles.size
			};
		}
	);
};
