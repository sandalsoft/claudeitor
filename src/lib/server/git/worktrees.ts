import type { RepoInfo } from './types.js';
import type { WorktreeInfo } from '$lib/data/types';
import { safeExecFile } from '$lib/server/system/ports';
import { warn } from '$lib/server/telemetry/logger.js';

const GIT_TIMEOUT_MS = 10_000;

/**
 * Get all worktrees for a single repository.
 * Uses `git worktree list --porcelain` for reliable parsing.
 */
export async function getRepoWorktrees(repo: RepoInfo): Promise<WorktreeInfo[]> {
	const result = await safeExecFile(
		'git',
		['worktree', 'list', '--porcelain'],
		{ cwd: repo.path, timeout: GIT_TIMEOUT_MS }
	);

	if (result.timedOut) {
		warn('worktrees', 'git worktree list timed out', { 'git.cwd': repo.path });
		return [];
	}

	if (result.exitCode !== 0 && !result.stdout.trim()) {
		warn('worktrees', 'git worktree list failed', {
			'git.cwd': repo.path,
			'exec.exit_code': result.exitCode,
			'exec.stderr': result.stderr.trim()
		});
		return [];
	}

	return parseWorktreeOutput(result.stdout, repo.name, repo.path);
}

/**
 * Parse `git worktree list --porcelain` output.
 * Each worktree is a block separated by blank lines:
 *
 *   worktree /path/to/worktree
 *   HEAD abc123...
 *   branch refs/heads/main
 *
 * Bare worktrees show "bare" instead of "branch".
 * Detached HEADs show "detached" instead of "branch".
 *
 * Exported for testing.
 */
export function parseWorktreeOutput(stdout: string, repoName: string, repoPath: string): WorktreeInfo[] {
	if (!stdout.trim()) return [];

	const worktrees: WorktreeInfo[] = [];
	// Split by blank lines to get individual worktree blocks
	const blocks = stdout.split(/\n\n+/);

	for (const block of blocks) {
		const trimmed = block.trim();
		if (!trimmed) continue;

		const lines = trimmed.split('\n');
		let path = '';
		let head = '';
		let branch = '';
		let isBare = false;
		let isDetached = false;

		for (const line of lines) {
			if (line.startsWith('worktree ')) {
				path = line.substring('worktree '.length);
			} else if (line.startsWith('HEAD ')) {
				head = line.substring('HEAD '.length);
			} else if (line.startsWith('branch ')) {
				// e.g. "branch refs/heads/main" -> "main"
				const ref = line.substring('branch '.length);
				branch = ref.replace(/^refs\/heads\//, '');
			} else if (line === 'bare') {
				isBare = true;
			} else if (line === 'detached') {
				isDetached = true;
			}
		}

		if (!path) continue;

		// Determine branch display label
		let branchLabel: string;
		if (isBare) {
			branchLabel = 'bare';
		} else if (isDetached) {
			branchLabel = 'detached';
		} else {
			branchLabel = branch || 'unknown';
		}

		// The main worktree is the first one listed, and its path matches the repo path
		const isMain = path === repoPath;

		worktrees.push({
			path,
			head,
			branch: branchLabel,
			isMain,
			repo: repoName,
			repoPath
		});
	}

	return worktrees;
}
