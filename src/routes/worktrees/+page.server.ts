import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { getRepoWorktrees } from '$lib/server/git/worktrees';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:worktrees',
		{
			'code.filepath': 'src/routes/worktrees/+page.server.ts',
			'http.route': '/worktrees'
		},
		async () => {
			const config = await readConfig();
			const gitResult = await scanRepos(config.repoDirs);

			// Gather worktrees for all discovered repos in parallel
			const worktreeArrays = await Promise.all(
				gitResult.repos.map((repo) => getRepoWorktrees(repo))
			);
			const worktrees = worktreeArrays.flat();

			// Count repos that have extra worktrees (more than just the main one)
			const reposWithExtraWorktrees = new Set(
				worktrees.filter((w) => !w.isMain).map((w) => w.repoPath)
			).size;

			// Count non-main worktrees
			const extraWorktreeCount = worktrees.filter((w) => !w.isMain).length;

			return {
				worktrees,
				totalRepos: gitResult.repos.length,
				totalWorktrees: worktrees.length,
				reposWithExtraWorktrees,
				extraWorktreeCount,
				errors: gitResult.errors
			};
		}
	);
};
