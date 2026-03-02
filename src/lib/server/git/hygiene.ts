import type { RepoInfo } from './types.js';
import type { HygieneIssue, StaleBranch } from '$lib/data/types';
import { safeExecFile } from '$lib/server/system/ports';
import { info, warn } from '$lib/server/telemetry/logger.js';

const STALE_DAYS = 60;
const STALE_THRESHOLD_MS = STALE_DAYS * 24 * 60 * 60 * 1000;
const MAX_STALE_DISPLAYED = 10;
const GIT_TIMEOUT_MS = 10_000;

/**
 * Gather hygiene issues for a single repository.
 *
 * Sources:
 * - RepoInfo fields: uncommitted changes, unpushed commits (no extra git calls)
 * - git for-each-ref: stale branches (>60 days, excluding current branch)
 * - git rev-list HEAD..@{u}: current branch behind upstream
 */
export async function getRepoHygieneIssues(repo: RepoInfo): Promise<HygieneIssue[]> {
	const issues: HygieneIssue[] = [];

	// ── From RepoInfo (no extra git calls) ───────────────────
	if (repo.uncommittedFileCount > 0) {
		issues.push({
			repo: repo.name,
			repoPath: repo.path,
			label: 'Uncommitted changes',
			severity: 'warn',
			detail: `${repo.uncommittedFileCount} file${repo.uncommittedFileCount === 1 ? '' : 's'} with uncommitted changes`
		});
	}

	if (repo.unpushedCommitCount > 0) {
		issues.push({
			repo: repo.name,
			repoPath: repo.path,
			label: 'Unpushed commits',
			severity: 'warn',
			detail: `${repo.unpushedCommitCount} commit${repo.unpushedCommitCount === 1 ? '' : 's'} not pushed to remote`
		});
	}

	// ── Stale branches (requires git call) ───────────────────
	const staleResult = await getStaleBranches(repo);
	if (staleResult.length > 0) {
		issues.push({
			repo: repo.name,
			repoPath: repo.path,
			label: 'Stale branches',
			severity: 'warn',
			detail: `${staleResult.length} branch${staleResult.length === 1 ? '' : 'es'} with no commits in ${STALE_DAYS}+ days`,
			staleBranches: staleResult.slice(0, MAX_STALE_DISPLAYED),
			staleBranchCount: staleResult.length
		});
	}

	// ── Current branch behind upstream ───────────────────────
	const behindResult = await getBehindUpstream(repo);
	if (behindResult.type === 'behind') {
		issues.push({
			repo: repo.name,
			repoPath: repo.path,
			label: 'Current branch behind upstream',
			severity: 'warn',
			detail: `Branch "${repo.branch}" is ${behindResult.count} commit${behindResult.count === 1 ? '' : 's'} behind upstream`
		});
	} else if (behindResult.type === 'no-upstream') {
		issues.push({
			repo: repo.name,
			repoPath: repo.path,
			label: 'No upstream configured',
			severity: 'info',
			detail: `Branch "${repo.branch}" has no upstream tracking branch`
		});
	}

	return issues;
}

/**
 * Get stale branches: branches with no commits in STALE_DAYS days,
 * excluding the current branch.
 * Returns sorted by oldest first.
 */
async function getStaleBranches(repo: RepoInfo): Promise<StaleBranch[]> {
	const result = await safeExecFile(
		'git',
		['for-each-ref', '--sort=-committerdate', '--format=%(refname:short) %(committerdate:unix)', 'refs/heads/'],
		{ cwd: repo.path, timeout: GIT_TIMEOUT_MS }
	);

	if (result.timedOut) {
		warn('hygiene', 'git for-each-ref timed out', { 'git.cwd': repo.path });
		return [];
	}

	if (result.exitCode !== 0 && !result.stdout.trim()) {
		warn('hygiene', 'git for-each-ref failed', {
			'git.cwd': repo.path,
			'exec.exit_code': result.exitCode,
			'exec.stderr': result.stderr.trim()
		});
		return [];
	}

	return parseStaleBranches(result.stdout, repo.branch);
}

/**
 * Parse for-each-ref output to find stale branches.
 * Exported for testing.
 */
export function parseStaleBranches(stdout: string, currentBranch: string): StaleBranch[] {
	if (!stdout.trim()) return [];

	const now = Date.now();
	const staleThresholdUnix = (now - STALE_THRESHOLD_MS) / 1000;
	const stale: StaleBranch[] = [];

	for (const line of stdout.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Format: "branch-name unix-timestamp"
		const lastSpace = trimmed.lastIndexOf(' ');
		if (lastSpace === -1) continue;

		const name = trimmed.substring(0, lastSpace);
		const unixStr = trimmed.substring(lastSpace + 1);
		const lastCommitUnix = parseInt(unixStr, 10);

		if (isNaN(lastCommitUnix)) continue;

		// Skip the current branch
		if (name === currentBranch) continue;

		// Stale = last commit older than threshold
		if (lastCommitUnix < staleThresholdUnix) {
			stale.push({ name, lastCommitUnix });
		}
	}

	// Sort oldest first
	stale.sort((a, b) => a.lastCommitUnix - b.lastCommitUnix);

	return stale;
}

type BehindResult =
	| { type: 'behind'; count: number }
	| { type: 'no-upstream' }
	| { type: 'up-to-date' };

/**
 * Check if the current branch is behind its upstream.
 * Uses `git rev-list --count HEAD..@{u}`.
 */
async function getBehindUpstream(repo: RepoInfo): Promise<BehindResult> {
	const result = await safeExecFile(
		'git',
		['rev-list', '--count', 'HEAD..@{u}'],
		{ cwd: repo.path, timeout: GIT_TIMEOUT_MS }
	);

	// No upstream configured -- git exits non-zero with stderr mentioning "no upstream"
	if (result.exitCode !== 0) {
		const stderr = result.stderr.toLowerCase();
		if (stderr.includes('no upstream') || stderr.includes('no such ref')) {
			info('hygiene', `No upstream for ${repo.branch} in ${repo.name}`, {
				'git.cwd': repo.path,
				'git.branch': repo.branch
			});
			return { type: 'no-upstream' };
		}
		warn('hygiene', 'git rev-list HEAD..@{u} failed', {
			'git.cwd': repo.path,
			'exec.exit_code': result.exitCode,
			'exec.stderr': result.stderr.trim()
		});
		return { type: 'no-upstream' };
	}

	const count = parseInt(result.stdout.trim(), 10);
	if (isNaN(count) || count === 0) {
		return { type: 'up-to-date' };
	}

	return { type: 'behind', count };
}
