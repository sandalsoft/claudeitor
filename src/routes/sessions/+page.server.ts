import type { PageServerLoad } from './$types';
import { readSessionHistory } from '$lib/server/claude/sessions';
import { readConfig } from '$lib/server/config';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ url }) => {
	const config = await readConfig();
	const allSessions = await readSessionHistory(config.claudeDir);

	// Search filter
	const query = url.searchParams.get('q')?.toLowerCase() ?? '';

	// Sort: newest first by default
	const sortDir = url.searchParams.get('sort') === 'asc' ? 'asc' : 'desc';

	// Pagination
	const pageParam = parseInt(url.searchParams.get('page') ?? '1', 10);
	const currentPage = Math.max(1, isNaN(pageParam) ? 1 : pageParam);

	// Filter by search query
	const filtered = query
		? allSessions.filter(
				(s) =>
					s.display.toLowerCase().includes(query) ||
					(s.project && s.project.toLowerCase().includes(query))
			)
		: allSessions;

	// Sort by timestamp
	const sorted = [...filtered].sort((a, b) =>
		sortDir === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
	);

	// Paginate
	const totalCount = sorted.length;
	const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
	const safePage = Math.min(currentPage, totalPages);
	const startIdx = (safePage - 1) * PAGE_SIZE;
	const paginated = sorted.slice(startIdx, startIdx + PAGE_SIZE);

	return {
		sessions: paginated,
		totalCount,
		totalPages,
		currentPage: safePage,
		query,
		sortDir
	};
};
