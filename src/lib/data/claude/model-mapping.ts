import type { PricingData } from '../types.js';

/**
 * Multi-strategy model ID mapping.
 *
 * Converts full Anthropic model IDs (e.g. "claude-opus-4-5-20251101")
 * to pricing short names (e.g. "opus-4-5").
 *
 * Strategy order:
 *   1. Exact match against pricing keys
 *   2. Regex: strip "claude-" prefix and date suffix, compare
 *   3. Normalization: tokenize and score overlap against pricing keys
 *   4. Fallback: return raw ID as-is (log warning)
 */

const DATE_SUFFIX_RE = /-\d{8}$/;
const CLAUDE_PREFIX_RE = /^claude-/;

/**
 * Strip "claude-" prefix and trailing "-YYYYMMDD" date suffix.
 */
function stripPrefixAndDate(modelId: string): string {
	return modelId.replace(CLAUDE_PREFIX_RE, '').replace(DATE_SUFFIX_RE, '');
}

/**
 * Tokenize a model name into comparable parts.
 * "opus-4-5" → ["opus", "4", "5"]
 */
function tokenize(name: string): string[] {
	return name.split('-').filter(Boolean);
}

/**
 * Score how well two token arrays overlap.
 * Returns a value between 0 and 1 (1 = perfect match).
 */
function tokenOverlap(a: string[], b: string[]): number {
	if (a.length === 0 || b.length === 0) return 0;
	const setA = new Set(a);
	const matches = b.filter((t) => setA.has(t)).length;
	return matches / Math.max(a.length, b.length);
}

// Internal cache: full model ID → resolved short name
const mappingCache = new Map<string, string>();

/**
 * Map a full model ID to a pricing short name.
 *
 * @param modelId - Full model ID (e.g. "claude-opus-4-5-20251101")
 * @param pricing - Pricing data with available model keys
 * @returns The resolved short name, or the raw ID if no match found
 */
export function mapModelId(modelId: string, pricing: PricingData | null): string {
	if (!modelId) return modelId;

	const cached = mappingCache.get(modelId);
	if (cached !== undefined) return cached;

	const pricingKeys = pricing ? Object.keys(pricing.models) : [];

	// Strategy 1: Exact match
	if (pricingKeys.includes(modelId)) {
		mappingCache.set(modelId, modelId);
		return modelId;
	}

	// Strategy 2: Strip prefix + date, compare directly
	const stripped = stripPrefixAndDate(modelId);
	if (pricingKeys.includes(stripped)) {
		mappingCache.set(modelId, stripped);
		return stripped;
	}

	// Strategy 3: Token-overlap normalization
	if (pricingKeys.length > 0) {
		const strippedTokens = tokenize(stripped);
		let bestKey = '';
		let bestScore = 0;

		for (const key of pricingKeys) {
			const keyTokens = tokenize(key);
			const score = tokenOverlap(strippedTokens, keyTokens);
			if (score > bestScore) {
				bestScore = score;
				bestKey = key;
			}
		}

		// Require a meaningful overlap (at least 50%)
		if (bestScore >= 0.5) {
			mappingCache.set(modelId, bestKey);
			return bestKey;
		}
	}

	// Strategy 4: Fallback — return raw ID, log warning
	console.warn(`[model-mapping] Unknown model ID, no pricing match: "${modelId}"`);
	mappingCache.set(modelId, modelId);
	return modelId;
}

/**
 * Clear the mapping cache. Useful when pricing data changes.
 */
export function clearMappingCache(): void {
	mappingCache.clear();
}
