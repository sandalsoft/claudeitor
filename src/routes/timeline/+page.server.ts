import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { readSessionHistory } from '$lib/server/claude/sessions';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export interface TimelineEvent {
	id: string;
	type: 'commit' | 'session';
	timestamp: number;
	date: string;
	title: string;
	detail: string;
	repo?: string;
	meta?: Record<string, string>;
}

const PAGE_SIZE = 30;

// Default window: last 30 days (matches git commit scan window).
// This caps the amount of session data materialized in memory.
const DEFAULT_WINDOW_DAYS = 30;

export const load: PageServerLoad = async ({ url }) => {
	return withSpan(
		'load:timeline',
		{
			'code.filepath': 'src/routes/timeline/+page.server.ts',
			'http.route': '/timeline'
		},
		async () => {
			const config = await readConfig();

			const [gitResult, allSessions] = await Promise.all([
				scanRepos(config.repoDirs),
				readSessionHistory(config.claudeDir)
			]);

			// Parse filters up front so we can apply them during construction
			const repoFilter = url.searchParams.get('repo') ?? '';
			const typeFilter = url.searchParams.get('type') ?? '';
			const dateFrom = url.searchParams.get('from') ?? '';
			const dateTo = url.searchParams.get('to') ?? '';
			const pageParam = parseInt(url.searchParams.get('page') ?? '1', 10);
			const currentPage = Math.max(1, isNaN(pageParam) ? 1 : pageParam);

			// Compute time bounds: use dateFrom/dateTo if provided and valid,
			// otherwise fall back to the default 30-day window.
			const now = Date.now();
			const defaultStart = now - DEFAULT_WINDOW_DAYS * 86_400_000;

			const parsedFrom = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : NaN;
			const parsedTo = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : NaN;

			const windowStart = Number.isFinite(parsedFrom) ? parsedFrom : defaultStart;
			const windowEnd = Number.isFinite(parsedTo) ? parsedTo : now;

			const events: TimelineEvent[] = [];
			const repoNameSet = new Set<string>();

			// Add commits (already bounded to last 30 days by scanner)
			const includeCommits = typeFilter !== 'session';
			if (includeCommits) {
				for (const repo of gitResult.repos) {
					repoNameSet.add(repo.name);
					if (
						repoFilter &&
						!repo.name.toLowerCase().includes(repoFilter.toLowerCase())
					) {
						continue;
					}
					for (const commit of repo.commits) {
						const commitTime = new Date(commit.date).getTime();
						if (commitTime < windowStart || commitTime > windowEnd) continue;

						events.push({
							id: `commit-${commit.hash}`,
							type: 'commit',
							timestamp: commitTime,
							date: commit.date,
							title: commit.subject,
							detail: commit.authorName,
							repo: repo.name,
							meta: {
								hash: commit.hash.slice(0, 7),
								branch: repo.branch,
								email: commit.authorEmail
							}
						});
					}
				}
			}

			// Add sessions -- bounded to time window and filtered early
			const includeSessions = typeFilter !== 'commit';
			if (includeSessions) {
				for (const session of allSessions) {
					if (session.timestamp < windowStart || session.timestamp > windowEnd) continue;

					const projectName = session.project
						? session.project.split('/').pop() ?? session.project
						: 'Unknown project';

					repoNameSet.add(projectName);
					if (
						repoFilter &&
						!projectName.toLowerCase().includes(repoFilter.toLowerCase())
					) {
						continue;
					}

					events.push({
						id: `session-${session.timestamp}-${session.sessionId ?? ''}`,
						type: 'session',
						timestamp: session.timestamp,
						date: new Date(session.timestamp).toISOString(),
						title: session.display.slice(0, 120),
						detail: projectName,
						repo: projectName
					});
				}
			}

			// Sort newest first
			events.sort((a, b) => b.timestamp - a.timestamp);

			// Paginate
			const totalCount = events.length;
			const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
			const safePage = Math.min(currentPage, totalPages);
			const startIdx = (safePage - 1) * PAGE_SIZE;
			const paginated = events.slice(startIdx, startIdx + PAGE_SIZE);

			// Unique repo names for the filter dropdown (from all data, not just filtered)
			const repoNames = [...repoNameSet].sort((a, b) => a.localeCompare(b));

			return {
				events: paginated,
				totalCount,
				totalPages,
				currentPage: safePage,
				repoFilter,
				typeFilter,
				dateFrom,
				dateTo,
				repoNames
			};
		}
	);
};
