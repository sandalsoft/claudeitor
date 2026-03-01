import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { readSessionHistory } from '$lib/server/claude/sessions';

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

export const load: PageServerLoad = async ({ url }) => {
	const config = await readConfig();

	const [gitResult, sessions] = await Promise.all([
		scanRepos(config.repoDirs),
		readSessionHistory(config.claudeDir)
	]);

	// Build unified event list
	const events: TimelineEvent[] = [];

	// Add commits from all repos
	for (const repo of gitResult.repos) {
		for (const commit of repo.commits) {
			events.push({
				id: `commit-${commit.hash}`,
				type: 'commit',
				timestamp: new Date(commit.date).getTime(),
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

	// Add sessions
	for (const session of sessions) {
		const projectName = session.project
			? session.project.split('/').pop() ?? session.project
			: 'Unknown project';

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

	// Filters from query params
	const repoFilter = url.searchParams.get('repo') ?? '';
	const typeFilter = url.searchParams.get('type') ?? '';
	const dateFrom = url.searchParams.get('from') ?? '';
	const dateTo = url.searchParams.get('to') ?? '';
	const pageParam = parseInt(url.searchParams.get('page') ?? '1', 10);
	const currentPage = Math.max(1, isNaN(pageParam) ? 1 : pageParam);

	// Apply filters
	let filtered = events;

	if (repoFilter) {
		filtered = filtered.filter(
			(e) => e.repo?.toLowerCase().includes(repoFilter.toLowerCase())
		);
	}

	if (typeFilter === 'commit' || typeFilter === 'session') {
		filtered = filtered.filter((e) => e.type === typeFilter);
	}

	if (dateFrom) {
		const fromTs = new Date(dateFrom + 'T00:00:00').getTime();
		if (!isNaN(fromTs)) {
			filtered = filtered.filter((e) => e.timestamp >= fromTs);
		}
	}

	if (dateTo) {
		const toTs = new Date(dateTo + 'T23:59:59').getTime();
		if (!isNaN(toTs)) {
			filtered = filtered.filter((e) => e.timestamp <= toTs);
		}
	}

	// Sort newest first
	filtered.sort((a, b) => b.timestamp - a.timestamp);

	// Paginate
	const totalCount = filtered.length;
	const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
	const safePage = Math.min(currentPage, totalPages);
	const startIdx = (safePage - 1) * PAGE_SIZE;
	const paginated = filtered.slice(startIdx, startIdx + PAGE_SIZE);

	// Unique repo names for the filter dropdown
	const repoNames = [...new Set(events.map((e) => e.repo).filter(Boolean))] as string[];
	repoNames.sort((a, b) => a.localeCompare(b));

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
};
