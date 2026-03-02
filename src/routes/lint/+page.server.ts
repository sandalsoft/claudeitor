import type { PageServerLoad, Actions } from './$types';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { lintRepo } from '$lib/server/lint/runner';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:lint',
		{
			'code.filepath': 'src/routes/lint/+page.server.ts',
			'http.route': '/lint'
		},
		async () => {
			const config = await readConfig();
			const gitResult = await scanRepos(config.repoDirs);

			// On initial page load, return repos but don't run lints
			// Lints are triggered on-demand via form action
			const repos = gitResult.repos.map((r) => ({
				name: r.name,
				path: r.path
			}));

			return {
				repos,
				results: [] as Awaited<ReturnType<typeof lintRepo>>[],
				totalRepos: gitResult.repos.length,
				linted: false,
				errors: gitResult.errors
			};
		}
	);
};

export const actions = {
	lint: async () => {
		return withSpan(
			'action:lint:run',
			{
				'code.filepath': 'src/routes/lint/+page.server.ts',
				'http.route': '/lint'
			},
			async () => {
				const config = await readConfig();
				const gitResult = await scanRepos(config.repoDirs);

				// Run lint in parallel for all discovered repos
				const results = await Promise.all(
					gitResult.repos.map((repo) => lintRepo(repo.path))
				);

				// Summary stats
				const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
				const totalWarnings = results.reduce((sum, r) => sum + r.warningCount, 0);
				const reposWithIssues = results.filter(
					(r) => r.errorCount > 0 || r.warningCount > 0
				).length;
				const eslintAvailableCount = results.filter((r) => r.eslintAvailable).length;
				const tscAvailableCount = results.filter((r) => r.tscAvailable).length;

				return {
					results,
					totalRepos: gitResult.repos.length,
					totalErrors,
					totalWarnings,
					reposWithIssues,
					eslintAvailableCount,
					tscAvailableCount,
					linted: true
				};
			}
		);
	}
} satisfies Actions;
