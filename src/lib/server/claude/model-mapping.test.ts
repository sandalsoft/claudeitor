import { describe, it, expect, beforeEach } from 'vitest';
import { mapModelId, clearMappingCache } from './model-mapping.js';
import type { PricingData } from '../../data/types.js';

const PRICING: PricingData = {
	updated: '2026-02-23',
	source: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
	models: {
		'opus-4-6': { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 },
		'opus-4-5': { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 },
		'sonnet-4-5': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
		'sonnet-3-5': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
		'haiku-4-5': { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
		'haiku-3-5': { input: 0.25, output: 1.25, cacheRead: 0.03, cacheWrite: 0.3 }
	}
};

describe('mapModelId', () => {
	beforeEach(() => {
		clearMappingCache();
	});

	describe('Strategy 1: Exact match', () => {
		it('returns the ID when it is already a pricing key', () => {
			expect(mapModelId('opus-4-5', PRICING)).toBe('opus-4-5');
			expect(mapModelId('sonnet-3-5', PRICING)).toBe('sonnet-3-5');
		});
	});

	describe('Strategy 2: Strip prefix and date', () => {
		it('strips claude- prefix and date suffix to match', () => {
			expect(mapModelId('claude-opus-4-5-20251101', PRICING)).toBe('opus-4-5');
			expect(mapModelId('claude-sonnet-4-5-20250929', PRICING)).toBe('sonnet-4-5');
			expect(mapModelId('claude-haiku-4-5-20251001', PRICING)).toBe('haiku-4-5');
		});

		it('handles models without date suffix', () => {
			expect(mapModelId('claude-opus-4-6', PRICING)).toBe('opus-4-6');
		});
	});

	describe('Strategy 3: Strict normalization', () => {
		it('maps claude-3-5-sonnet-YYYYMMDD to sonnet-3-5', () => {
			expect(mapModelId('claude-3-5-sonnet-20241022', PRICING)).toBe('sonnet-3-5');
		});

		it('maps claude-3-5-haiku-YYYYMMDD to haiku-3-5', () => {
			expect(mapModelId('claude-3-5-haiku-20241022', PRICING)).toBe('haiku-3-5');
		});

		it('does NOT mismatch sonnet-3-5 to sonnet-4-5', () => {
			// This was the critical bug: token overlap would match wrong version
			const pricingWithout35: PricingData = {
				updated: '2026-02-23',
				source: '',
				models: {
					'sonnet-4-5': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 }
				}
			};
			// With strict matching, 3-5-sonnet should NOT map to sonnet-4-5
			const result = mapModelId('claude-3-5-sonnet-20241022', pricingWithout35);
			expect(result).not.toBe('sonnet-4-5');
			expect(result).toBe('claude-3-5-sonnet-20241022'); // fallback to raw ID
		});
	});

	describe('Strategy 4: Fallback', () => {
		it('returns raw ID for completely unknown models', () => {
			expect(mapModelId('gpt-4-turbo', PRICING)).toBe('gpt-4-turbo');
		});

		it('returns raw ID when no pricing data available', () => {
			const result = mapModelId('claude-opus-4-5-20251101', null);
			expect(result).toBe('claude-opus-4-5-20251101');
		});

		it('returns raw ID for empty pricing models', () => {
			const emptyPricing: PricingData = { updated: '', source: '', models: {} };
			const result = mapModelId('claude-opus-4-5-20251101', emptyPricing);
			expect(result).toBe('claude-opus-4-5-20251101');
		});
	});

	describe('Edge cases', () => {
		it('handles empty model ID', () => {
			expect(mapModelId('', PRICING)).toBe('');
		});

		it('caches results for repeated lookups', () => {
			const first = mapModelId('claude-opus-4-5-20251101', PRICING);
			const second = mapModelId('claude-opus-4-5-20251101', PRICING);
			expect(first).toBe(second);
			expect(first).toBe('opus-4-5');
		});

		it('clearMappingCache resets cache', () => {
			mapModelId('claude-opus-4-5-20251101', PRICING);
			clearMappingCache();
			expect(mapModelId('claude-opus-4-5-20251101', PRICING)).toBe('opus-4-5');
		});

		it('invalidates cache when pricing changes', () => {
			// First call with null pricing → returns raw ID (not cached)
			const raw = mapModelId('claude-opus-4-5-20251101', null);
			expect(raw).toBe('claude-opus-4-5-20251101');

			// Second call with real pricing → should resolve correctly
			const resolved = mapModelId('claude-opus-4-5-20251101', PRICING);
			expect(resolved).toBe('opus-4-5');
		});
	});
});
