import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { StatsCache } from '../types.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const STATS_FILE = join(CLAUDE_DIR, 'stats-cache.json');

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

export async function readStatsCache(): Promise<StatsCache> {
	try {
		const raw = await readFile(STATS_FILE, 'utf-8');
		const data = JSON.parse(raw) as StatsCache;
		return data;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return EMPTY_STATS;
		}
		console.warn('[stats] Failed to parse stats-cache.json:', (err as Error).message);
		return EMPTY_STATS;
	}
}
