import { exec } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { promisify } from 'node:util';
import type { RepoCommit, RepoInfo, GitScanResult } from './types.js';

const execAsync = promisify(exec);
const GIT_TIMEOUT_MS = 10_000;
const MAX_SCAN_DEPTH = 3;

// Split cache: commit log keyed by path+HEAD; working-tree always fresh
const commitCache = new Map<string, { headHash: string; commits: RepoCommit[]; branch: string }>();

/**
 * Run a git command in a directory with timeout handling.
 * Returns stdout or null on failure.
 */
async function gitExec(cwd: string, args: string): Promise<string | null> {
	try {
		const { stdout } = await execAsync(`git ${args}`, { cwd, timeout: GIT_TIMEOUT_MS });
		return stdout.trim();
	} catch (err) {
		const msg = (err as Error).message;
		if (msg.includes('TIMEOUT') || msg.includes('timed out')) {
			console.warn(`[git] Timeout executing "git ${args}" in ${cwd}`);
		}
		return null;
	}
}

/**
 * Check whether git is available on the system.
 */
export async function isGitAvailable(): Promise<boolean> {
	try {
		await execAsync('git --version', { timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Recursively discover git repositories under the given directories.
 * Stops at MAX_SCAN_DEPTH and skips node_modules / hidden directories.
 */
export async function discoverRepos(dirs: string[]): Promise<string[]> {
	const repos: string[] = [];

	async function walk(dir: string, depth: number): Promise<void> {
		if (depth > MAX_SCAN_DEPTH) return;

		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return; // permission denied or missing
		}

		// Check if this directory is itself a git repo
		const hasGit = entries.some((e) => e.name === '.git' && e.isDirectory());
		if (hasGit) {
			repos.push(dir);
			return; // don't recurse into git repos
		}

		// Recurse into subdirectories
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
			await walk(join(dir, entry.name), depth + 1);
		}
	}

	for (const dir of dirs) {
		// Check if the dir itself is a git repo first
		let dirEntries;
		try {
			dirEntries = await readdir(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		const isGitRoot = dirEntries.some((e) => e.name === '.git' && e.isDirectory());
		if (isGitRoot) {
			repos.push(dir);
		} else {
			await walk(dir, 0);
		}
	}

	return repos;
}

/**
 * Get the current HEAD hash for a repository.
 */
async function getHeadHash(repoPath: string): Promise<string | null> {
	return gitExec(repoPath, 'rev-parse HEAD');
}

/**
 * Get recent commits for a repo (last 30 days).
 */
async function getRecentCommits(repoPath: string): Promise<RepoCommit[]> {
	const format = '%H%n%s%n%aN%n%aE%n%aI'; // hash, subject, author, email, date
	const raw = await gitExec(repoPath, `log --format="${format}" --since="30 days ago" -100`);
	if (!raw) return [];

	const lines = raw.split('\n');
	const commits: RepoCommit[] = [];
	for (let i = 0; i + 4 < lines.length; i += 5) {
		commits.push({
			hash: lines[i],
			subject: lines[i + 1],
			authorName: lines[i + 2],
			authorEmail: lines[i + 3],
			date: lines[i + 4]
		});
	}
	return commits;
}

/**
 * Get the current branch name.
 */
async function getCurrentBranch(repoPath: string): Promise<string> {
	return (await gitExec(repoPath, 'rev-parse --abbrev-ref HEAD')) ?? 'unknown';
}

/**
 * Get uncommitted file count using git status --porcelain (always fresh).
 */
async function getUncommittedFileCount(repoPath: string): Promise<number> {
	const raw = await gitExec(repoPath, 'status --porcelain');
	if (!raw) return 0;
	return raw.split('\n').filter(Boolean).length;
}

/**
 * Get unpushed commit count (always fresh).
 */
async function getUnpushedCommitCount(repoPath: string): Promise<number> {
	const raw = await gitExec(repoPath, 'rev-list @{u}..HEAD --count');
	if (!raw) return 0;
	const count = parseInt(raw, 10);
	return isNaN(count) ? 0 : count;
}

/**
 * Get full repo info with split caching strategy:
 * - Expensive data (commits, branch): cached by path + HEAD hash
 * - Working-tree data (uncommitted, unpushed): always refreshed
 */
export async function getRepoInfo(repoPath: string): Promise<RepoInfo | null> {
	const headHash = await getHeadHash(repoPath);
	if (!headHash) return null;

	const cacheKey = repoPath;
	const cached = commitCache.get(cacheKey);

	let commits: RepoCommit[];
	let branch: string;

	if (cached && cached.headHash === headHash) {
		// HEAD unchanged — reuse cached expensive data
		commits = cached.commits;
		branch = cached.branch;
	} else {
		// HEAD changed or first scan — refresh expensive data
		[commits, branch] = await Promise.all([getRecentCommits(repoPath), getCurrentBranch(repoPath)]);
		commitCache.set(cacheKey, { headHash, commits, branch });
	}

	// Always refresh cheap working-tree data
	const [uncommittedFileCount, unpushedCommitCount] = await Promise.all([
		getUncommittedFileCount(repoPath),
		getUnpushedCommitCount(repoPath)
	]);

	return {
		path: repoPath,
		name: basename(repoPath),
		branch,
		headHash,
		commits,
		uncommittedFileCount,
		unpushedCommitCount,
		lastFetched: Date.now()
	};
}

/**
 * Scan all configured directories for git repos and gather info.
 */
export async function scanRepos(repoDirs: string[]): Promise<GitScanResult> {
	const gitAvailable = await isGitAvailable();
	if (!gitAvailable) {
		return {
			repos: [],
			errors: ['Git binary not found. Please install git to enable repository scanning.']
		};
	}

	const repoPaths = await discoverRepos(repoDirs);
	const errors: string[] = [];
	const repos: RepoInfo[] = [];

	for (const repoPath of repoPaths) {
		try {
			const info = await getRepoInfo(repoPath);
			if (info) repos.push(info);
		} catch (err) {
			errors.push(`Failed to scan ${repoPath}: ${(err as Error).message}`);
		}
	}

	return { repos, errors };
}

/**
 * Get commit count across all given repos for today (local time).
 */
export function getCommitsToday(repos: RepoInfo[]): number {
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const tomorrowStart = todayStart + 86_400_000;

	let count = 0;
	for (const repo of repos) {
		for (const commit of repo.commits) {
			const commitTime = new Date(commit.date).getTime();
			if (commitTime >= todayStart && commitTime < tomorrowStart) count++;
		}
	}
	return count;
}

/**
 * Clear the commit cache (useful for testing).
 */
export function clearCommitCache(): void {
	commitCache.clear();
}
