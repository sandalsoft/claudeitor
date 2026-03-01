import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { readSkills } from '$lib/server/claude/skills';
import type { RepoInfo } from '$lib/server/git/types';

export type HealthStatus = 'green' | 'yellow' | 'red';

export interface RepoRow {
	name: string;
	path: string;
	branch: string;
	lastCommitDate: string;
	lastCommitSubject: string;
	uncommittedFileCount: number;
	unpushedCommitCount: number;
	health: HealthStatus;
	commitCount: number;
}

function deriveHealth(repo: RepoInfo): HealthStatus {
	if (repo.uncommittedFileCount > 0 && repo.unpushedCommitCount > 0) return 'red';
	if (repo.uncommittedFileCount > 0 || repo.unpushedCommitCount > 0) return 'yellow';
	return 'green';
}

export const load: PageServerLoad = async ({ url }) => {
	const config = await readConfig();

	const [gitResult, skills] = await Promise.all([
		scanRepos(config.repoDirs),
		readSkills(config.claudeDir)
	]);

	// Build repo rows with health status
	const repos: RepoRow[] = gitResult.repos.map((repo) => {
		const lastCommit = repo.commits[0];
		return {
			name: repo.name,
			path: repo.path,
			branch: repo.branch,
			lastCommitDate: lastCommit?.date ?? '',
			lastCommitSubject: lastCommit?.subject ?? 'No recent commits',
			uncommittedFileCount: repo.uncommittedFileCount,
			unpushedCommitCount: repo.unpushedCommitCount,
			health: deriveHealth(repo),
			commitCount: repo.commits.length
		};
	});

	// Sorting from query params
	type SortKey = 'name' | 'activity' | 'health';
	const sortParam = url.searchParams.get('sort') as SortKey | null;
	const validSortKeys: SortKey[] = ['name', 'activity', 'health'];
	const sortKey: SortKey = sortParam && validSortKeys.includes(sortParam) ? sortParam : 'activity';
	const sortDir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

	// Health severity: higher = worse. Default desc = worst first.
	const healthSeverity: Record<HealthStatus, number> = { green: 0, yellow: 1, red: 2 };

	repos.sort((a, b) => {
		switch (sortKey) {
			case 'name':
				// asc = A-Z, desc = Z-A
				return sortDir === 'asc'
					? a.name.localeCompare(b.name)
					: b.name.localeCompare(a.name);
			case 'health':
				// desc = worst (red) first, asc = cleanest (green) first
				return sortDir === 'asc'
					? healthSeverity[a.health] - healthSeverity[b.health]
					: healthSeverity[b.health] - healthSeverity[a.health];
			case 'activity':
			default: {
				// desc = most recent first (default), asc = oldest first
				const aTime = a.lastCommitDate ? new Date(a.lastCommitDate).getTime() : 0;
				const bTime = b.lastCommitDate ? new Date(b.lastCommitDate).getTime() : 0;
				return sortDir === 'asc' ? aTime - bTime : bTime - aTime;
			}
		}
	});

	return {
		repos,
		skillCount: skills.length,
		errors: gitResult.errors,
		sortKey,
		sortDir
	};
};
