import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { CostCache, PricingData } from '../../data/types.js';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

const EMPTY_COST_CACHE: CostCache = {
	version: 0,
	lastFullScan: '',
	days: {}
};

const EMPTY_PRICING: PricingData = {
	updated: '',
	source: '',
	models: {}
};

export async function readCostCache(claudeDir = DEFAULT_CLAUDE_DIR): Promise<CostCache> {
	try {
		const raw = await readFile(join(claudeDir, 'readout-cost-cache.json'), 'utf-8');
		return JSON.parse(raw) as CostCache;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return EMPTY_COST_CACHE;
		}
		console.warn('[costs] Failed to parse readout-cost-cache.json:', (err as Error).message);
		return EMPTY_COST_CACHE;
	}
}

export async function readPricing(claudeDir = DEFAULT_CLAUDE_DIR): Promise<PricingData> {
	try {
		const raw = await readFile(join(claudeDir, 'readout-pricing.json'), 'utf-8');
		return JSON.parse(raw) as PricingData;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return EMPTY_PRICING;
		}
		console.warn('[costs] Failed to parse readout-pricing.json:', (err as Error).message);
		return EMPTY_PRICING;
	}
}
