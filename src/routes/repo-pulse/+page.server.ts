import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { withSpan } from '$lib/server/telemetry/span-helpers';
import type { RepoInfo } from '$lib/server/git/types';
import type { RepoPulseInfo } from '$lib/data/types';

/**
 * Derive all pulse metrics from RepoInfo fields only.
 * No additional git calls, no readStatsCache.
 */
function deriveRepoPulse(repo: RepoInfo): RepoPulseInfo {
	const now = Date.now();
	const sevenDaysAgo = now - 7 * 86_400_000;
	const thirtyDaysAgo = now - 30 * 86_400_000;

	let commits7d = 0;
	let commits30d = 0;
	const contributorSet = new Set<string>();
	let lastCommitDate = '';

	// Daily buckets for sparkline (30 days, index 0 = oldest day)
	const dayBuckets = new Array<number>(30).fill(0);
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);

	for (const commit of repo.commits) {
		const commitTime = new Date(commit.date).getTime();

		if (commitTime >= thirtyDaysAgo) {
			commits30d++;
			contributorSet.add(commit.authorName);

			// Sparkline bucket: days ago from today's start
			const daysAgo = Math.floor((todayStart.getTime() - commitTime) / 86_400_000);
			const bucketIdx = 29 - daysAgo; // 0 = oldest (29 days ago), 29 = today
			if (bucketIdx >= 0 && bucketIdx < 30) {
				dayBuckets[bucketIdx]++;
			}
		}

		if (commitTime >= sevenDaysAgo) {
			commits7d++;
		}

		// Track most recent commit
		if (!lastCommitDate || commit.date > lastCommitDate) {
			lastCommitDate = commit.date;
		}
	}

	const activityScore = commits7d * 3 + commits30d;

	return {
		name: repo.name,
		path: repo.path,
		branch: repo.branch,
		commits7d,
		commits30d,
		contributors: [...contributorSet],
		lastCommitDate,
		uncommittedFileCount: repo.uncommittedFileCount,
		unpushedCommitCount: repo.unpushedCommitCount,
		activityScore,
		sparkline: dayBuckets
	};
}

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:repo-pulse',
		{
			'code.filepath': 'src/routes/repo-pulse/+page.server.ts',
			'http.route': '/repo-pulse'
		},
		async () => {
			const config = await readConfig();
			const gitResult = await scanRepos(config.repoDirs);

			const pulses: RepoPulseInfo[] = gitResult.repos.map(deriveRepoPulse);

			// Sort by activity score (most active first)
			pulses.sort((a, b) => b.activityScore - a.activityScore);

			// Summary stats
			const totalCommits7d = pulses.reduce((sum, p) => sum + p.commits7d, 0);
			const totalCommits30d = pulses.reduce((sum, p) => sum + p.commits30d, 0);
			const allContributors = new Set(pulses.flatMap((p) => p.contributors));

			return {
				pulses,
				totalCommits7d,
				totalCommits30d,
				uniqueContributors: allContributors.size,
				repoCount: gitResult.repos.length,
				errors: gitResult.errors
			};
		}
	);
};
