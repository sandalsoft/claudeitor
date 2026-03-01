import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { CostCache, PricingData } from '../../data/types.js';
import { withSpan } from '../telemetry/span-helpers.js';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

function emptyCostCache(): CostCache {
	return { version: 0, lastFullScan: '', days: {} };
}

function emptyPricing(): PricingData {
	return { updated: '', source: '', models: {} };
}

export async function readCostCache(claudeDir = DEFAULT_CLAUDE_DIR): Promise<CostCache> {
	return withSpan(
		'op:readCostCache',
		{
			'code.filepath': 'src/lib/server/claude/costs.ts',
			'data.source': 'readout-cost-cache.json'
		},
		async () => {
			try {
				const raw = await readFile(join(claudeDir, 'readout-cost-cache.json'), 'utf-8');
				return JSON.parse(raw) as CostCache;
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
					return emptyCostCache();
				}
				console.warn('[costs] Failed to parse readout-cost-cache.json:', (err as Error).message);
				return emptyCostCache();
			}
		}
	);
}

export async function readPricing(claudeDir = DEFAULT_CLAUDE_DIR): Promise<PricingData> {
	return withSpan(
		'op:readPricing',
		{
			'code.filepath': 'src/lib/server/claude/costs.ts',
			'data.source': 'readout-pricing.json'
		},
		async () => {
			try {
				const raw = await readFile(join(claudeDir, 'readout-pricing.json'), 'utf-8');
				return JSON.parse(raw) as PricingData;
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
					return emptyPricing();
				}
				console.warn('[costs] Failed to parse readout-pricing.json:', (err as Error).message);
				return emptyPricing();
			}
		}
	);
}
