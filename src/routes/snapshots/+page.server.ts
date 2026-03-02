import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { withSpan } from '$lib/server/telemetry/span-helpers';
import { warn } from '$lib/server/telemetry/logger';
import { execFile } from 'node:child_process';
import type { SnapshotEntry } from '$lib/data/types';

const PAGE_SIZE = 20;
const EXEC_TIMEOUT_MS = 10_000;

/**
 * Run `git show --numstat --format= <hash>` to count files changed.
 * Uses execFile with array args (no shell quoting needed).
 */
async function getFilesChanged(repoPath: string, hash: string): Promise<number> {
	return new Promise((resolve) => {
		execFile(
			'git',
			['show', '--numstat', '--format=', hash],
			{ cwd: repoPath, timeout: EXEC_TIMEOUT_MS },
			(err, stdout) => {
				if (err) {
					warn('snapshots', `Failed to get numstat for ${hash} in ${repoPath}`, {
						'error.type': (err as Error).name
					});
					resolve(0);
					return;
				}
				// Each non-empty line in --numstat output represents a file change
				const count = stdout
					.trim()
					.split('\n')
					.filter((l) => l.trim()).length;
				resolve(count);
			}
		);
	});
}

export const load: PageServerLoad = async ({ url }) => {
	return withSpan(
		'load:snapshots',
		{
			'code.filepath': 'src/routes/snapshots/+page.server.ts',
			'http.route': '/snapshots'
		},
		async () => {
			const config = await readConfig();
			const gitResult = await scanRepos(config.repoDirs);

			// Flatten all commits from all repos, attaching repo info
			const allEntries: SnapshotEntry[] = [];

			for (const repo of gitResult.repos) {
				for (const commit of repo.commits) {
					allEntries.push({
						hash: commit.hash,
						subject: commit.subject,
						authorName: commit.authorName,
						authorEmail: commit.authorEmail,
						date: commit.date,
						repo: repo.name,
						repoPath: repo.path,
						filesChanged: 0 // populated for current page only
					});
				}
			}

			// Sort chronologically descending (most recent first)
			allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

			// Pagination
			const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
			const totalEntries = allEntries.length;
			const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
			const clampedPage = Math.min(page, totalPages);
			const startIdx = (clampedPage - 1) * PAGE_SIZE;
			const pageEntries = allEntries.slice(startIdx, startIdx + PAGE_SIZE);

			// Get file change counts only for the current page (max 20)
			const fileCountPromises = pageEntries.map(async (entry) => {
				entry.filesChanged = await getFilesChanged(entry.repoPath, entry.hash);
				return entry;
			});
			await Promise.all(fileCountPromises);

			// Summary stats — repoCount from discovered repos (not commits),
			// so we correctly show "no commits" vs "no repos" empty states.
			const uniqueAuthors = new Set(allEntries.map((e) => e.authorName));

			return {
				entries: pageEntries,
				totalEntries,
				page: clampedPage,
				totalPages,
				pageSize: PAGE_SIZE,
				repoCount: gitResult.repos.length,
				authorCount: uniqueAuthors.size,
				errors: gitResult.errors
			};
		}
	);
};
