import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { scanAllEnvKeys } from '$lib/server/env/reader';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:env',
		{
			'code.filepath': 'src/routes/env/+page.server.ts',
			'http.route': '/env'
		},
		async () => {
			const config = await readConfig();
			const gitResult = await scanRepos(config.repoDirs);

			// Use discovered repo paths (not raw repoDirs)
			const repoPaths = gitResult.repos.map((r) => r.path);
			const variables = await scanAllEnvKeys(repoPaths);

			// Count unique repos that have env files
			const repoSet = new Set<string>();
			for (const v of variables) {
				for (const repo of v.repos) {
					repoSet.add(repo);
				}
			}

			return {
				variables,
				totalVariables: variables.length,
				reposWithEnvFiles: repoSet.size,
				totalRepos: gitResult.repos.length
			};
		}
	);
};
