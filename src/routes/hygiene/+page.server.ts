import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { getRepoHygieneIssues } from '$lib/server/git/hygiene';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:hygiene',
		{
			'code.filepath': 'src/routes/hygiene/+page.server.ts',
			'http.route': '/hygiene'
		},
		async () => {
			const config = await readConfig();
			const gitResult = await scanRepos(config.repoDirs);

			// Gather hygiene issues for all discovered repos in parallel
			const issueArrays = await Promise.all(
				gitResult.repos.map((repo) => getRepoHygieneIssues(repo))
			);
			const issues = issueArrays.flat();

			// Summary counts
			const errorCount = issues.filter((i) => i.severity === 'error').length;
			const warnCount = issues.filter((i) => i.severity === 'warn').length;
			const infoCount = issues.filter((i) => i.severity === 'info').length;

			// Repos with issues
			const reposWithIssues = new Set(issues.map((i) => i.repoPath)).size;

			return {
				issues,
				totalRepos: gitResult.repos.length,
				reposWithIssues,
				errorCount,
				warnCount,
				infoCount,
				errors: gitResult.errors
			};
		}
	);
};
