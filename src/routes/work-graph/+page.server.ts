import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { safeExecFile } from '$lib/server/system/exec';
import { withSpan } from '$lib/server/telemetry/span-helpers';
import { warn } from '$lib/server/telemetry/logger';
import type { BranchNode, BranchEdge } from '$lib/data/types';

const BRANCH_LIMIT = 100;

/** Determine the default branch for a repo (checking origin/HEAD, then main, then master). */
async function getDefaultBranch(repoPath: string): Promise<string> {
	// Try symbolic-ref first (remote default)
	const symRef = await safeExecFile('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
		cwd: repoPath,
		timeout: 5_000
	});
	if (symRef.exitCode === 0 && symRef.stdout.trim()) {
		// e.g. "refs/remotes/origin/main" -> "main"
		const ref = symRef.stdout.trim();
		const parts = ref.split('/');
		return parts[parts.length - 1];
	}

	// Fallback: check if main exists
	const mainCheck = await safeExecFile('git', ['rev-parse', '--verify', 'main'], {
		cwd: repoPath,
		timeout: 5_000
	});
	if (mainCheck.exitCode === 0) return 'main';

	// Fallback: check if master exists
	const masterCheck = await safeExecFile('git', ['rev-parse', '--verify', 'master'], {
		cwd: repoPath,
		timeout: 5_000
	});
	if (masterCheck.exitCode === 0) return 'master';

	// Last resort: current branch
	const headRef = await safeExecFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
		cwd: repoPath,
		timeout: 5_000
	});
	return headRef.stdout.trim() || 'main';
}

interface RawBranch {
	name: string;
	hashShort: string;
	date: string;
	repoName: string;
	repoPath: string;
}

/** Enumerate all branches for a repo, filtering out *​/HEAD symbolic refs. */
async function listBranches(repoPath: string, repoName: string): Promise<RawBranch[]> {
	const result = await safeExecFile(
		'git',
		['branch', '-a', '--format=%(refname:short) %(objectname:short) %(committerdate:iso8601)'],
		{ cwd: repoPath, timeout: 10_000 }
	);

	if (result.exitCode !== 0 || !result.stdout.trim()) return [];

	const branches: RawBranch[] = [];
	for (const line of result.stdout.trim().split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Filter out */HEAD symbolic refs (e.g. "origin/HEAD")
		const branchName = trimmed.split(' ')[0];
		if (branchName.endsWith('/HEAD')) continue;

		// Parse: "branchname hashShort 2025-01-15 10:30:00 -0800"
		// The format has branch, hash, then date (which may contain spaces)
		const spaceIdx = trimmed.indexOf(' ');
		if (spaceIdx === -1) continue;
		const rest = trimmed.slice(spaceIdx + 1);
		const hashEnd = rest.indexOf(' ');
		if (hashEnd === -1) continue;

		const hashShort = rest.slice(0, hashEnd);
		const date = rest.slice(hashEnd + 1).trim();

		branches.push({ name: branchName, hashShort, date, repoName, repoPath });
	}

	return branches;
}

/** Get the merge-base between two branches. */
async function getMergeBase(
	repoPath: string,
	branch: string,
	defaultBranch: string
): Promise<string> {
	const result = await safeExecFile('git', ['merge-base', branch, defaultBranch], {
		cwd: repoPath,
		timeout: 5_000
	});
	if (result.exitCode !== 0) return '';
	return result.stdout.trim().slice(0, 7); // abbreviated
}

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:work-graph',
		{
			'code.filepath': 'src/routes/work-graph/+page.server.ts',
			'http.route': '/work-graph'
		},
		async () => {
			const config = await readConfig();
			const gitResult = await scanRepos(config.repoDirs);

			const allBranches: RawBranch[] = [];
			const defaultBranches = new Map<string, string>(); // repoPath -> default branch name

			// Enumerate branches per repo
			for (const repo of gitResult.repos) {
				try {
					const [branches, defaultBranch] = await Promise.all([
						listBranches(repo.path, repo.name),
						getDefaultBranch(repo.path)
					]);
					defaultBranches.set(repo.path, defaultBranch);
					allBranches.push(...branches);
				} catch (err) {
					warn('work-graph', `Failed to enumerate branches for ${repo.name}`, {
						'repo.path': repo.path,
						'error.message': (err as Error).message
					});
				}
			}

			// Global sort by committerdate (most recent first), then take top BRANCH_LIMIT
			allBranches.sort(
				(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
			);
			const topBranches = allBranches.slice(0, BRANCH_LIMIT);

			// Build nodes and edges
			const nodes: BranchNode[] = [];
			const edges: BranchEdge[] = [];

			for (const br of topBranches) {
				const defaultBranch = defaultBranches.get(br.repoPath) ?? 'main';
				const isDefault = br.name === defaultBranch || br.name === `origin/${defaultBranch}`;

				nodes.push({
					id: `${br.repoName}:${br.name}`,
					repo: br.repoName,
					branch: br.name,
					headShort: br.hashShort,
					date: br.date,
					isDefault
				});
			}

			// Build edges: non-default branches -> default branch (hub-and-spoke)
			for (const br of topBranches) {
				const defaultBranch = defaultBranches.get(br.repoPath) ?? 'main';
				const isDefault = br.name === defaultBranch || br.name === `origin/${defaultBranch}`;
				if (isDefault) continue;

				// Find the default branch node for this repo
				const hubId = `${br.repoName}:${defaultBranch}`;
				const hubExists = nodes.some((n) => n.id === hubId);
				if (!hubExists) continue;

				const mergeBase = await getMergeBase(br.repoPath, br.name, defaultBranch);
				edges.push({
					source: `${br.repoName}:${br.name}`,
					target: hubId,
					mergeBase
				});
			}

			return {
				nodes,
				edges,
				totalBranches: allBranches.length,
				repoCount: gitResult.repos.length,
				errors: gitResult.errors
			};
		}
	);
};
