/**
 * Active Claude session detection.
 *
 * Detects running Claude Code processes via `ps aux` and correlates them
 * with recent session files by PID/timestamp heuristics. This is inherently
 * a best-effort approach since Claude Code session-to-process mapping is
 * not a formal contract.
 */

import { exec } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

export interface ActiveSession {
	pid: number;
	command: string;
	startedAt: string;
	project?: string;
	sessionId?: string;
	cpuPercent: number;
	memPercent: number;
}

/**
 * Detect running Claude Code processes by scanning the process table.
 * Uses `ps -axo` with explicit columns for deterministic parsing
 * (avoids layout-dependent parsing of `ps aux`).
 * Filters to processes whose command includes "claude" but excludes
 * this dashboard's own server process and grep itself.
 */
export async function detectActiveSessions(
	claudeDir = DEFAULT_CLAUDE_DIR
): Promise<ActiveSession[]> {
	try {
		// Use `etimes` (elapsed seconds, numeric) instead of locale-dependent
		// start time strings. maxBuffer handles busy systems.
		// Column headers suppressed with `=` suffix for cleaner parsing.
		const { stdout } = await execAsync(
			'ps -axo pid=,pcpu=,pmem=,etimes=,command=',
			{ timeout: 5000, maxBuffer: 8 * 1024 * 1024 }
		);
		const lines = stdout.split('\n');
		const sessions: ActiveSession[] = [];

		for (const line of lines) {
			if (!line.trim()) continue;

			// Columns: PID %CPU %MEM ELAPSED_SECS COMMAND
			const match = line.trim().match(/^(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(.+)$/);
			if (!match) continue;

			const pid = parseInt(match[1], 10);
			const cpuPercent = parseFloat(match[2]) || 0;
			const memPercent = parseFloat(match[3]) || 0;
			const elapsedSecs = parseInt(match[4], 10);
			const startTime = new Date(Date.now() - elapsedSecs * 1000).toISOString();
			const command = match[5];

			// Match Claude Code processes -- look for the "claude" CLI
			// but exclude grep, this server, and editor processes
			const cmdLower = command.toLowerCase();
			if (!cmdLower.includes('claude')) continue;
			if (cmdLower.includes('grep')) continue;
			if (cmdLower.includes('claudeitor')) continue;
			if (cmdLower.includes('svelte')) continue;
			if (cmdLower.includes('vite')) continue;

			// Only match actual Claude Code invocations
			// Matches: claude, claude-code, claude --resume, etc.
			const isClaudeProcess =
				/\bclaude\b/.test(cmdLower) &&
				!cmdLower.includes('claude-mem') &&
				!cmdLower.includes('claude-marketplace');

			if (!isClaudeProcess) continue;

			// Try to extract project from --project or cwd hints in the command
			let project: string | undefined;
			const projectMatch = command.match(/--project\s+(\S+)/);
			if (projectMatch) {
				project = projectMatch[1];
			}

			sessions.push({
				pid,
				command: truncateCommand(command),
				startedAt: startTime,
				project,
				cpuPercent,
				memPercent
			});
		}

		// Try to correlate with recent session files
		await correlateWithSessionFiles(sessions, claudeDir);

		return sessions;
	} catch {
		return [];
	}
}

/**
 * Truncate long command strings for display.
 */
function truncateCommand(cmd: string, maxLen = 120): string {
	if (cmd.length <= maxLen) return cmd;
	return cmd.slice(0, maxLen - 3) + '...';
}

/**
 * Best-effort correlation: match active PIDs to recent session JSONL files.
 *
 * To avoid excessive filesystem work on every poll, we:
 * 1. Stop once every active session has been assigned a sessionId.
 * 2. Only stat the 5 most recent .jsonl files per project dir (sorted by
 *    name which is a UUID, so we pick arbitrarily but bound the work).
 * 3. Skip files older than 5 minutes.
 */
async function correlateWithSessionFiles(
	sessions: ActiveSession[],
	claudeDir: string
): Promise<void> {
	if (sessions.length === 0) return;

	const projectsDir = join(claudeDir, 'projects');
	const fiveMinAgo = Date.now() - 5 * 60 * 1000;
	const MAX_FILES_PER_DIR = 5;

	/** Check if all sessions have been assigned. */
	function allAssigned(): boolean {
		return sessions.every((s) => s.sessionId !== undefined);
	}

	try {
		const dirs = await readdir(projectsDir);

		for (const dir of dirs) {
			if (allAssigned()) break;

			const dirPath = join(projectsDir, dir);
			let files;
			try {
				files = await readdir(dirPath);
			} catch {
				continue;
			}

			// Only inspect a bounded number of .jsonl files
			const jsonlFiles = files.filter((f) => f.endsWith('.jsonl')).slice(-MAX_FILES_PER_DIR);

			for (const file of jsonlFiles) {
				if (allAssigned()) break;

				const filePath = join(dirPath, file);
				try {
					const fstat = await stat(filePath);
					if (fstat.mtimeMs <= fiveMinAgo) continue;

					const sessionId = basename(file, '.jsonl');
					const projectPath = dir.startsWith('-')
						? dir.slice(1).replace(/-/g, '/')
						: dir;

					// Try to match by project path first
					let assigned = false;
					for (const session of sessions) {
						if (
							!session.sessionId &&
							session.project &&
							projectPath.includes(session.project)
						) {
							session.sessionId = sessionId;
							assigned = true;
							break;
						}
					}
					// Fall back: assign to first unmatched session without a project
					if (!assigned) {
						for (const session of sessions) {
							if (!session.sessionId && !session.project) {
								session.sessionId = sessionId;
								session.project = projectPath;
								break;
							}
						}
					}
				} catch {
					continue;
				}
			}
		}
	} catch {
		// projects dir doesn't exist
	}
}
