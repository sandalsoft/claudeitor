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
 * Detect running Claude Code processes by scanning `ps aux`.
 * Filters to processes whose command includes "claude" but excludes
 * this dashboard's own server process and grep itself.
 */
export async function detectActiveSessions(
	claudeDir = DEFAULT_CLAUDE_DIR
): Promise<ActiveSession[]> {
	try {
		const { stdout } = await execAsync('ps aux', { timeout: 5000 });
		const lines = stdout.split('\n').slice(1); // skip header
		const sessions: ActiveSession[] = [];

		for (const line of lines) {
			if (!line.trim()) continue;

			// Parse ps aux columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
			const parts = line.trim().split(/\s+/);
			if (parts.length < 11) continue;

			const pid = parseInt(parts[1], 10);
			const cpuPercent = parseFloat(parts[2]) || 0;
			const memPercent = parseFloat(parts[3]) || 0;
			const startTime = parts[8];
			const command = parts.slice(10).join(' ');

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

						// Assign to first session without a sessionId that matches the project
						for (const session of sessions) {
							if (!session.sessionId) {
								session.sessionId = sessionId;
								if (!session.project) {
									session.project = projectPath;
								}
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
