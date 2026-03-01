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
		// Explicit columns for deterministic parsing; maxBuffer handles busy systems.
		const { stdout } = await execAsync('ps -axo pid,pcpu,pmem,lstart,command', {
			timeout: 5000,
			maxBuffer: 8 * 1024 * 1024
		});
		const lines = stdout.split('\n').slice(1); // skip header
		const sessions: ActiveSession[] = [];

		for (const line of lines) {
			if (!line.trim()) continue;

			// Columns: PID %CPU %MEM LSTART(4 tokens: day month date time) COMMAND
			// Example:  1234  0.0  0.1 Sun Mar  1 02:30:00 2026 /usr/bin/claude ...
			const match = line
				.trim()
				.match(
					/^(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.+)$/
				);
			if (!match) continue;

			const pid = parseInt(match[1], 10);
			const cpuPercent = parseFloat(match[2]) || 0;
			const memPercent = parseFloat(match[3]) || 0;
			const startTime = match[4];
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
 * Best-effort correlation: match active PIDs to recent session JSONL files
 * by checking modification timestamps of session files within the last 5 minutes.
 */
async function correlateWithSessionFiles(
	sessions: ActiveSession[],
	claudeDir: string
): Promise<void> {
	if (sessions.length === 0) return;

	const projectsDir = join(claudeDir, 'projects');
	const fiveMinAgo = Date.now() - 5 * 60 * 1000;

	try {
		const dirs = await readdir(projectsDir);

		for (const dir of dirs) {
			const dirPath = join(projectsDir, dir);
			let files;
			try {
				files = await readdir(dirPath);
			} catch {
				continue;
			}

			for (const file of files) {
				if (!file.endsWith('.jsonl')) continue;

				const filePath = join(dirPath, file);
				try {
					const fstat = await stat(filePath);
					// Recently modified session files might belong to an active session
					if (fstat.mtimeMs > fiveMinAgo) {
						const sessionId = basename(file, '.jsonl');
						// Decode project path from directory name (reverse of encodeProjectPath)
						const projectPath = dir.startsWith('-')
							? dir.slice(1).replace(/-/g, '/')
							: dir;

						// Try to match by project path first, then fall back to
						// unassigned sessions. Prevents misassociation when
						// multiple sessions are active simultaneously.
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
