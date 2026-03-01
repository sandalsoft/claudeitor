import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { StatsCache } from '../../data/types.js';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

const EMPTY_STATS: StatsCache = {
	version: 0,
	lastComputedDate: '',
	dailyActivity: [],
	dailyModelTokens: [],
	modelUsage: {},
	totalSessions: 0,
	totalMessages: 0,
	longestSession: 0,
	firstSessionDate: '',
	hourCounts: {},
	totalSpeculationTimeSavedMs: 0
};

export async function readStatsCache(claudeDir = DEFAULT_CLAUDE_DIR): Promise<StatsCache> {
	try {
		const raw = await readFile(join(claudeDir, 'stats-cache.json'), 'utf-8');
		return JSON.parse(raw) as StatsCache;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return EMPTY_STATS;
		}
		console.warn('[stats] Failed to parse stats-cache.json:', (err as Error).message);
		return EMPTY_STATS;
	}
}
