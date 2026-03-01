import { describe, it, expect, beforeEach } from 'vitest';
import { mapModelId, clearMappingCache } from './model-mapping.js';
import type { PricingData } from '../types.js';

const PRICING: PricingData = {
	updated: '2026-02-23',
	source: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
	models: {
		'opus-4-6': { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 },
		'opus-4-5': { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 },
		'sonnet-4-5': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
		'haiku-4-5': { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 }
	}
};

describe('mapModelId', () => {
	beforeEach(() => {
		clearMappingCache();
	});

	it('returns exact match when model ID is already a pricing key', () => {
		expect(mapModelId('opus-4-5', PRICING)).toBe('opus-4-5');
	});

	it('strips claude- prefix and date suffix to match', () => {
		expect(mapModelId('claude-opus-4-5-20251101', PRICING)).toBe('opus-4-5');
		expect(mapModelId('claude-sonnet-4-5-20250929', PRICING)).toBe('sonnet-4-5');
		expect(mapModelId('claude-haiku-4-5-20251001', PRICING)).toBe('haiku-4-5');
		expect(mapModelId('claude-opus-4-6', PRICING)).toBe('opus-4-6');
	});

	it('handles models without date suffix', () => {
		expect(mapModelId('claude-opus-4-5', PRICING)).toBe('opus-4-5');
	});

	it('uses normalization for edge cases', () => {
		// "sonnet-3-5" not in pricing, but check it doesn't crash
		const result = mapModelId('claude-3-5-sonnet-20241022', PRICING);
		// This should either match via token overlap or fall through to raw ID
		expect(typeof result).toBe('string');
		expect(result.length).toBeGreaterThan(0);
	});

	it('returns raw ID for completely unknown models', () => {
		const result = mapModelId('gpt-4-turbo', PRICING);
		expect(result).toBe('gpt-4-turbo');
	});

	it('handles empty model ID', () => {
		expect(mapModelId('', PRICING)).toBe('');
	});

	it('handles null pricing', () => {
		const result = mapModelId('claude-opus-4-5-20251101', null);
		expect(result).toBe('claude-opus-4-5-20251101');
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
		// After clearing, it should still produce the same result
		expect(mapModelId('claude-opus-4-5-20251101', PRICING)).toBe('opus-4-5');
	});
});
