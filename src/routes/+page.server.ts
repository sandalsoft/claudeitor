import type { PageServerLoad } from './$types';
import { readStatsCache } from '$lib/server/claude/stats';
import { readCostCache, readPricing } from '$lib/server/claude/costs';
import { readSessionHistory } from '$lib/server/claude/sessions';
import { readSkills } from '$lib/server/claude/skills';
import { readAgents } from '$lib/server/claude/agents';
import { readConfig } from '$lib/server/config';
import { calculateCosts } from '$lib/server/claude/cost-calculator';
import { scanRepos, getCommitsToday } from '$lib/server/git/scanner';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Count non-empty lines in CLAUDE.md files (global + project-level).
 * Returns total line count as a rough measure of memory content.
 */
async function countClaudeMdLines(claudeDir: string): Promise<number> {
	const paths = [
		join(claudeDir, 'CLAUDE.md'),
		join(homedir(), 'CLAUDE.md')
	];

	let totalLines = 0;
	for (const p of paths) {
		try {
			const content = await readFile(p, 'utf-8');
			totalLines += content.split('\n').filter((l) => l.trim().length > 0).length;
		} catch {
			// File doesn't exist — skip
		}
	}
	return totalLines;
}

export const load: PageServerLoad = async () => {
	const config = await readConfig();

	// Parallel fetch all data sources
	const [stats, costCache, pricing, sessions, skills, agents, gitResult, memoryLines] =
		await Promise.all([
			readStatsCache(config.claudeDir),
			readCostCache(config.claudeDir),
			readPricing(config.claudeDir),
			readSessionHistory(config.claudeDir),
			readSkills(config.claudeDir),
			readAgents(config.claudeDir),
			scanRepos(config.repoDirs),
			countClaudeMdLines(config.claudeDir)
		]);

	const costSummary = calculateCosts(costCache, pricing);
	const commitsToday = getCommitsToday(gitResult.repos);

	// Recent sessions: last 5, sorted newest first
	const recentSessions = [...sessions]
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, 5);

	// Alerts: repos with hygiene issues
	const alerts: Array<{ id: string; message: string; severity: 'info' | 'warning' | 'error' }> =
		[];
	for (const repo of gitResult.repos) {
		if (repo.uncommittedFileCount > 0) {
			alerts.push({
				id: `uncommitted-${repo.name}`,
				message: `${repo.name}: ${repo.uncommittedFileCount} uncommitted file${repo.uncommittedFileCount === 1 ? '' : 's'}`,
				severity: 'warning'
			});
		}
		if (repo.unpushedCommitCount > 0) {
			alerts.push({
				id: `unpushed-${repo.name}`,
				message: `${repo.name}: ${repo.unpushedCommitCount} unpushed commit${repo.unpushedCommitCount === 1 ? '' : 's'}`,
				severity: 'info'
			});
		}
	}

	// Recently active repos: sorted by combined activity (commits + uncommitted + unpushed)
	const activeRepos = gitResult.repos
		.map((repo) => ({
			name: repo.name,
			path: repo.path,
			activity: repo.commits.length + repo.uncommittedFileCount + repo.unpushedCommitCount,
			branch: repo.branch
		}))
		.sort((a, b) => b.activity - a.activity)
		.slice(0, 8);

	return {
		stats,
		costSummary,
		recentSessions,
		alerts,
		activeRepos,
		skills: skills.length,
		agents: agents.length,
		memoryLines,
		repos: gitResult.repos.map((r) => r.name),
		repoCount: gitResult.repos.length,
		commitsToday,
		hasApiKey: config.anthropicApiKey.length > 0
	};
};
