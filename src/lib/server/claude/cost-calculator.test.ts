import { describe, it, expect, beforeEach } from 'vitest';
import { calculateCosts, calculateDailyCosts } from './cost-calculator.js';
import { clearMappingCache } from './model-mapping.js';
import type { CostCache, PricingData } from '../../data/types.js';

const PRICING: PricingData = {
	updated: '2026-02-23',
	source: 'test',
	models: {
		'opus-4-5': { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 },
		'sonnet-4-5': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
		'haiku-4-5': { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 }
	}
};

const COST_CACHE: CostCache = {
	version: 1,
	lastFullScan: '2026-02-28',
	days: {
		'2026-02-27': {
			'claude-opus-4-5-20251101': {
				input: 1_000_000,
				output: 500_000,
				cacheRead: 2_000_000,
				cacheWrite: 100_000
			},
			'claude-sonnet-4-5-20250929': {
				input: 500_000,
				output: 200_000,
				cacheRead: 1_000_000,
				cacheWrite: 50_000
			}
		},
		'2026-02-28': {
			'claude-opus-4-5-20251101': {
				input: 2_000_000,
				output: 1_000_000,
				cacheRead: 3_000_000,
				cacheWrite: 200_000
			}
		}
	}
};

beforeEach(() => {
	clearMappingCache();
});

describe('calculateCosts', () => {
	it('computes total cost across all days and models', () => {
		const result = calculateCosts(COST_CACHE, PRICING);
		expect(result.totalCostUSD).toBeGreaterThan(0);
		expect(result.byModel.length).toBe(2); // opus and sonnet
		expect(result.unknownModels).toEqual([]);
	});

	it('computes correct per-model costs', () => {
		const result = calculateCosts(COST_CACHE, PRICING);
		const opus = result.byModel.find((m) => m.pricingKey === 'opus-4-5');
		expect(opus).toBeDefined();

		// Day 1: input=1M*5/1M=5, output=500K*25/1M=12.5, cacheRead=2M*0.5/1M=1, cacheWrite=100K*6.25/1M=0.625
		// Day 2: input=2M*5/1M=10, output=1M*25/1M=25, cacheRead=3M*0.5/1M=1.5, cacheWrite=200K*6.25/1M=1.25
		// Total: input=15, output=37.5, cacheRead=2.5, cacheWrite=1.875 = 56.875
		expect(opus!.totalCostUSD).toBeCloseTo(56.875, 2);
		expect(opus!.inputCostUSD).toBeCloseTo(15, 2);
		expect(opus!.outputCostUSD).toBeCloseTo(37.5, 2);
	});

	it('sorts models by cost descending', () => {
		const result = calculateCosts(COST_CACHE, PRICING);
		for (let i = 1; i < result.byModel.length; i++) {
			expect(result.byModel[i - 1].totalCostUSD).toBeGreaterThanOrEqual(
				result.byModel[i].totalCostUSD
			);
		}
	});

	it('handles unknown models with $0 cost and warning', () => {
		const cacheWithUnknown: CostCache = {
			version: 1,
			lastFullScan: '2026-02-28',
			days: {
				'2026-02-28': {
					'gpt-4-turbo': { input: 1_000_000, output: 500_000, cacheRead: 0, cacheWrite: 0 }
				}
			}
		};

		const result = calculateCosts(cacheWithUnknown, PRICING);
		expect(result.unknownModels).toContain('gpt-4-turbo');
		const unknown = result.byModel.find((m) => m.modelId === 'gpt-4-turbo');
		expect(unknown).toBeDefined();
		expect(unknown!.totalCostUSD).toBe(0);
		expect(unknown!.totalTokens).toBe(1_500_000);
	});

	it('returns empty summary for empty cost cache', () => {
		const empty: CostCache = { version: 0, lastFullScan: '', days: {} };
		const result = calculateCosts(empty, PRICING);
		expect(result.totalCostUSD).toBe(0);
		expect(result.byModel).toEqual([]);
		expect(result.daily).toEqual([]);
	});

	it('returns empty summary for empty pricing', () => {
		const emptyPricing: PricingData = { updated: '', source: '', models: {} };
		const result = calculateCosts(COST_CACHE, emptyPricing);
		// All models become unknown
		expect(result.unknownModels.length).toBeGreaterThan(0);
		expect(result.totalCostUSD).toBe(0);
	});
});

describe('calculateDailyCosts', () => {
	it('returns daily cost array sorted by date', () => {
		const daily = calculateDailyCosts(COST_CACHE, PRICING);
		expect(daily).toHaveLength(2);
		expect(daily[0].date).toBe('2026-02-27');
		expect(daily[1].date).toBe('2026-02-28');
	});

	it('daily costs sum correctly', () => {
		const daily = calculateDailyCosts(COST_CACHE, PRICING);
		// Day 1 opus: 5+12.5+1+0.625 = 19.125
		// Day 1 sonnet: 1.5+3+0.3+0.1875 = 4.9875
		expect(daily[0].totalCostUSD).toBeCloseTo(19.125 + 4.9875, 2);
	});

	it('daily byModel breakdown works', () => {
		const daily = calculateDailyCosts(COST_CACHE, PRICING);
		expect(daily[0].byModel['opus-4-5']).toBeCloseTo(19.125, 2);
		expect(daily[0].byModel['sonnet-4-5']).toBeCloseTo(4.9875, 2);
	});
});
