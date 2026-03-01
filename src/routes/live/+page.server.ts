import type { PageServerLoad } from './$types';
import { detectActiveSessions } from '$lib/server/claude/active-sessions';
import { readSessionHistory } from '$lib/server/claude/sessions';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { withSpan } from '$lib/server/telemetry/span-helpers';

interface ActivityEvent {
	type: 'commit' | 'session';
	timestamp: number;
	title: string;
	detail: string;
	repo?: string;
}

// TTL cache for the activity feed to avoid re-scanning repos on every poll.
// Active session detection is cheap and always fresh; git+session scan is
// cached for 15 seconds so rapid polls don't shell out repeatedly.
// Keyed by config fingerprint to handle config changes at runtime.
let cachedEvents: ActivityEvent[] = [];
let cacheTimestamp = 0;
let cacheKey = '';
const CACHE_TTL_MS = 15_000;

async function loadActivityEvents(
	claudeDir: string,
	repoDirs: string[]
): Promise<ActivityEvent[]> {
	const now = Date.now();
	const key = `${claudeDir}|${repoDirs.join(',')}`;
	if (key === cacheKey && cacheTimestamp > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
		return cachedEvents;
	}

	const [sessions, gitResult] = await Promise.all([
		readSessionHistory(claudeDir),
		scanRepos(repoDirs)
	]);

	const events: ActivityEvent[] = [];
	const oneDayAgo = now - 24 * 60 * 60 * 1000;

	// Add recent commits from all repos
	for (const repo of gitResult.repos) {
		for (const commit of repo.commits) {
			const commitTime = new Date(commit.date).getTime();
			if (commitTime >= oneDayAgo) {
				events.push({
					type: 'commit',
					timestamp: commitTime,
					title: commit.subject,
					detail: `${commit.authorName} in ${repo.name}`,
					repo: repo.name
				});
			}
		}
	}

	// Add recent sessions
	for (const session of sessions) {
		if (session.timestamp >= oneDayAgo) {
			const projectName = session.project
				? session.project.split('/').pop() ?? session.project
				: 'Unknown project';

			events.push({
				type: 'session',
				timestamp: session.timestamp,
				title: session.display.slice(0, 100),
				detail: projectName
			});
		}
	}

	// Sort newest first, limit to 50
	events.sort((a, b) => b.timestamp - a.timestamp);
	cachedEvents = events.slice(0, 50);
	cacheTimestamp = now;
	cacheKey = key;

	return cachedEvents;
}

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:live',
		{
			'code.filepath': 'src/routes/live/+page.server.ts',
			'http.route': '/live'
		},
		async () => {
			const config = await readConfig();

			// Active sessions are always fresh (cheap ps command);
			// activity feed uses a TTL cache to throttle git scanning.
			const [activeSessions, events] = await Promise.all([
				detectActiveSessions(config.claudeDir),
				loadActivityEvents(config.claudeDir, config.repoDirs)
			]);

			return {
				activeSessions,
				events,
				refreshInterval: config.refreshInterval
			};
		}
	);
};
