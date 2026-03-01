import type { PageServerLoad } from './$types';
import { detectActiveSessions } from '$lib/server/claude/active-sessions';
import { readSessionHistory } from '$lib/server/claude/sessions';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import type { RepoCommit } from '$lib/server/git/types';

interface ActivityEvent {
	type: 'commit' | 'session';
	timestamp: number;
	title: string;
	detail: string;
	repo?: string;
}

export const load: PageServerLoad = async () => {
	const config = await readConfig();

	const [activeSessions, sessions, gitResult] = await Promise.all([
		detectActiveSessions(config.claudeDir),
		readSessionHistory(config.claudeDir),
		scanRepos(config.repoDirs)
	]);

	// Build activity feed: recent commits + session starts, merged and sorted
	const events: ActivityEvent[] = [];
	const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

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
	const recentEvents = events.slice(0, 50);

	return {
		activeSessions,
		events: recentEvents,
		refreshInterval: config.refreshInterval
	};
};
