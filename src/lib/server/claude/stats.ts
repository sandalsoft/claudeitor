import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { StatsCache } from '../../data/types.js';
import { withSpan } from '../telemetry/span-helpers.js';
import { warn } from '../telemetry/logger.js';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

function emptyStats(): StatsCache {
	return {
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
}

export async function readStatsCache(claudeDir = DEFAULT_CLAUDE_DIR): Promise<StatsCache> {
	return withSpan(
		'op:readStatsCache',
		{
			'code.filepath': 'src/lib/server/claude/stats.ts',
			'data.source': 'stats-cache.json'
		},
		async () => {
			try {
				const raw = await readFile(join(claudeDir, 'stats-cache.json'), 'utf-8');
				return JSON.parse(raw) as StatsCache;
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
					return emptyStats();
				}
				warn('stats', 'Failed to parse stats-cache.json', {
					'error.type': (err as Error).name,
					'error.stack': (err as Error).stack
				});
				return emptyStats();
			}
		}
	);
}
