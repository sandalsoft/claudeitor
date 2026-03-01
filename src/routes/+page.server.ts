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
import type { SessionEntry } from '$lib/data/types';
import type { RepoInfo } from '$lib/server/git/types';

/**
 * Count non-empty lines in CLAUDE.md files (global + project-level).
 * Returns total line count as a rough measure of memory content.
 */
async function countClaudeMdLines(claudeDir: string): Promise<number> {
	const paths = [join(claudeDir, 'CLAUDE.md'), join(homedir(), 'CLAUDE.md')];

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

/**
 * Compute trend data: current period vs previous period.
 * For sessions: last 7 days vs previous 7 days.
 * For costs: last 7 days vs previous 7 days.
 * For commits: today vs yesterday.
 */
function computeTrends(
	sessions: SessionEntry[],
	repos: RepoInfo[],
	dailyCosts: Array<{ date: string; totalCostUSD: number }>
) {
	const now = Date.now();
	const DAY_MS = 86_400_000;
	const todayStart = new Date(
		new Date().getFullYear(),
		new Date().getMonth(),
		new Date().getDate()
	).getTime();

	// Sessions: last 7d vs previous 7d
	const last7dStart = now - 7 * DAY_MS;
	const prev7dStart = now - 14 * DAY_MS;
	const sessionsLast7d = sessions.filter((s) => s.timestamp >= last7dStart).length;
	const sessionsPrev7d = sessions.filter(
		(s) => s.timestamp >= prev7dStart && s.timestamp < last7dStart
	).length;

	// Commits: today vs yesterday
	const yesterdayStart = todayStart - DAY_MS;
	let commitsYesterday = 0;
	for (const repo of repos) {
		for (const commit of repo.commits) {
			const t = new Date(commit.date).getTime();
			if (t >= yesterdayStart && t < todayStart) commitsYesterday++;
		}
	}

	// Costs: last 7d vs previous 7d
	const today = new Date().toISOString().slice(0, 10);
	const last7dDate = new Date(now - 7 * DAY_MS).toISOString().slice(0, 10);
	const prev7dDate = new Date(now - 14 * DAY_MS).toISOString().slice(0, 10);

	let costLast7d = 0;
	let costPrev7d = 0;
	for (const day of dailyCosts) {
		if (day.date >= last7dDate && day.date <= today) costLast7d += day.totalCostUSD;
		else if (day.date >= prev7dDate && day.date < last7dDate) costPrev7d += day.totalCostUSD;
	}

	return {
		sessions: { current: sessionsLast7d, previous: sessionsPrev7d },
		commits: { current: getCommitsToday(repos), previous: commitsYesterday },
		cost: { current: costLast7d, previous: costPrev7d }
	};
}

/**
 * Count sessions per repo path for activity scoring.
 */
function countSessionsByRepo(sessions: SessionEntry[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const s of sessions) {
		if (s.project) {
			counts.set(s.project, (counts.get(s.project) ?? 0) + 1);
		}
	}
	return counts;
}

/**
 * Create a stable short ID from a repo path by hashing.
 * Uses a simple FNV-1a-inspired hash to avoid collisions from basename duplication.
 */
function stableRepoId(path: string): string {
	let hash = 2166136261;
	for (let i = 0; i < path.length; i++) {
		hash ^= path.charCodeAt(i);
		hash = (hash * 16777619) >>> 0;
	}
	return hash.toString(36);
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
	const trends = computeTrends(sessions, gitResult.repos, costSummary.daily);

	// Recent sessions: last 5, sorted newest first
	const recentSessions = [...sessions].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

	// Alerts: repos with hygiene issues (use path-based IDs for uniqueness)
	const alerts: Array<{
		id: string;
		message: string;
		severity: 'info' | 'warning' | 'error';
	}> = [];
	for (const repo of gitResult.repos) {
		const rid = stableRepoId(repo.path);
		if (repo.uncommittedFileCount > 0) {
			alerts.push({
				id: `uncommitted-${rid}`,
				message: `${repo.name}: ${repo.uncommittedFileCount} uncommitted file${repo.uncommittedFileCount === 1 ? '' : 's'}`,
				severity: 'warning'
			});
		}
		if (repo.unpushedCommitCount > 0) {
			alerts.push({
				id: `unpushed-${rid}`,
				message: `${repo.name}: ${repo.unpushedCommitCount} unpushed commit${repo.unpushedCommitCount === 1 ? '' : 's'}`,
				severity: 'info'
			});
		}
	}

	// Session counts per repo path for activity scoring
	const sessionsByRepo = countSessionsByRepo(sessions);

	// Recently active repos: sorted by combined score (commits + sessions + uncommitted + unpushed)
	const activeRepos = gitResult.repos
		.map((repo) => ({
			name: repo.name,
			id: stableRepoId(repo.path),
			activity:
				repo.commits.length +
				(sessionsByRepo.get(repo.path) ?? 0) +
				repo.uncommittedFileCount +
				repo.unpushedCommitCount,
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
		trends,
		hasApiKey: config.anthropicApiKey.length > 0
	};
};
