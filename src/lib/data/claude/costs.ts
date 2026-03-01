import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { CostCache, PricingData } from '../types.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const COST_FILE = join(CLAUDE_DIR, 'readout-cost-cache.json');
const PRICING_FILE = join(CLAUDE_DIR, 'readout-pricing.json');

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

export async function readCostCache(): Promise<CostCache> {
	try {
		const raw = await readFile(COST_FILE, 'utf-8');
		return JSON.parse(raw) as CostCache;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return EMPTY_COST_CACHE;
		}
		console.warn('[costs] Failed to parse readout-cost-cache.json:', (err as Error).message);
		return EMPTY_COST_CACHE;
	}
}

export async function readPricing(): Promise<PricingData> {
	try {
		const raw = await readFile(PRICING_FILE, 'utf-8');
		return JSON.parse(raw) as PricingData;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return EMPTY_PRICING;
		}
		console.warn('[costs] Failed to parse readout-pricing.json:', (err as Error).message);
		return EMPTY_PRICING;
	}
}
