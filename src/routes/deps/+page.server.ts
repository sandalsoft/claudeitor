import type { PageServerLoad, Actions } from './$types';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { auditRepo } from '$lib/server/deps/audit';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:deps',
		{
			'code.filepath': 'src/routes/deps/+page.server.ts',
			'http.route': '/deps'
		},
		async () => {
			const config = await readConfig();
			const gitResult = await scanRepos(config.repoDirs);

			// On initial page load, return repos but don't run audits
			// Audits are triggered on-demand via form action
			const repos = gitResult.repos.map((r) => ({
				name: r.name,
				path: r.path
			}));

			return {
				repos,
				results: [] as Awaited<ReturnType<typeof auditRepo>>[],
				totalRepos: gitResult.repos.length,
				audited: false,
				errors: gitResult.errors
			};
		}
	);
};

export const actions = {
	audit: async () => {
		return withSpan(
			'action:deps:audit',
			{
				'code.filepath': 'src/routes/deps/+page.server.ts',
				'http.route': '/deps'
			},
			async () => {
				const config = await readConfig();
				const gitResult = await scanRepos(config.repoDirs);

				// Run audits in parallel for all discovered repos
				const results = await Promise.all(
					gitResult.repos.map((repo) => auditRepo(repo.path))
				);

				// Summary stats
				const totalVulnerabilities = results.reduce((sum, r) => sum + r.totalVulnerabilities, 0);
				const totalOutdated = results.reduce((sum, r) => sum + r.outdated.length, 0);
				const reposWithIssues = results.filter(
					(r) => r.status === 'error' || r.status === 'warn'
				).length;

				return {
					results,
					totalRepos: gitResult.repos.length,
					totalVulnerabilities,
					totalOutdated,
					reposWithIssues,
					audited: true
				};
			}
		);
	}
} satisfies Actions;
