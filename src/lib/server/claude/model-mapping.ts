import type { PricingData } from '../../data/types.js';
import { withSpan } from '../telemetry/span-helpers.js';

/**
 * Multi-strategy model ID mapping.
 *
 * Converts full Anthropic model IDs (e.g. "claude-opus-4-5-20251101")
 * to pricing short names (e.g. "opus-4-5").
 *
 * Strategy order:
 *   1. Exact match against pricing keys
 *   2. Regex: strip "claude-" prefix and date suffix, compare
 *   3. Strict normalization: require family + version match
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
 * Extract version tokens (numeric parts) from a token array.
 * E.g. ["opus", "4", "5"] → ["4", "5"]
 *      ["3", "5", "sonnet"] → ["3", "5"]
 */
function extractVersion(tokens: string[]): string[] {
	return tokens.filter((t) => /^\d+$/.test(t));
}

/**
 * Extract non-numeric tokens (family/qualifier names).
 * E.g. ["opus", "4", "5"] → ["opus"]
 *      ["3", "5", "sonnet"] → ["sonnet"]
 */
function extractFamilyTokens(tokens: string[]): string[] {
	return tokens.filter((t) => !/^\d+$/.test(t));
}

/**
 * Derive known family names from pricing keys (not hard-coded).
 */
function deriveFamilyNames(pricingKeys: string[]): Set<string> {
	const families = new Set<string>();
	for (const key of pricingKeys) {
		for (const token of extractFamilyTokens(tokenize(key))) {
			families.add(token);
		}
	}
	return families;
}

// Cache keyed by modelId; invalidated when pricing fingerprint changes
const mappingCache = new Map<string, string>();
let cachedFingerprint = '';

function getPricingFingerprint(pricing: PricingData | null): string {
	if (!pricing) return '';
	return pricing.updated + ':' + Object.keys(pricing.models).sort().join(',');
}

/**
 * Map a full model ID to a pricing short name.
 *
 * @param modelId - Full model ID (e.g. "claude-opus-4-5-20251101")
 * @param pricing - Pricing data with available model keys
 * @returns The resolved short name, or the raw ID if no match found
 */
export function mapModelId(modelId: string, pricing: PricingData | null): string {
	if (!modelId) return modelId;

	return withSpan(
		'op:mapModelId',
		{
			'code.filepath': 'src/lib/server/claude/model-mapping.ts',
			'op.type': 'compute'
		},
		() => {
			const fingerprint = getPricingFingerprint(pricing);

			// Invalidate cache when pricing changes
			if (fingerprint !== cachedFingerprint) {
				mappingCache.clear();
				cachedFingerprint = fingerprint;
			}

			// Don't cache when pricing is unavailable (fallback results shouldn't stick)
			if (!pricing || Object.keys(pricing.models).length === 0) {
				console.warn(`[model-mapping] No pricing data, returning raw ID: "${modelId}"`);
				return modelId;
			}

			const cached = mappingCache.get(modelId);
			if (cached !== undefined) return cached;

			const pricingKeys = Object.keys(pricing.models);

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

			// Strategy 3: Strict normalization — require shared family token AND exact version match
			const strippedTokens = tokenize(stripped);
			const inputFamilyTokens = extractFamilyTokens(strippedTokens);
			const inputVersion = extractVersion(strippedTokens);
			const knownFamilies = deriveFamilyNames(pricingKeys);

			// Find family token from input that exists in pricing
			const inputFamily = inputFamilyTokens.find((t) => knownFamilies.has(t));

			if (inputFamily && inputVersion.length > 0) {
				for (const key of pricingKeys) {
					const keyTokens = tokenize(key);
					const keyFamilyTokens = extractFamilyTokens(keyTokens);
					const keyVersion = extractVersion(keyTokens);

					if (
						keyFamilyTokens.includes(inputFamily) &&
						keyVersion.length === inputVersion.length &&
						keyVersion.every((v, i) => v === inputVersion[i])
					) {
						mappingCache.set(modelId, key);
						return key;
					}
				}
			}

			// Strategy 4: Fallback — return raw ID, log warning
			console.warn(`[model-mapping] Unknown model ID, no pricing match: "${modelId}"`);
			mappingCache.set(modelId, modelId);
			return modelId;
		}
	);
}

/**
 * Clear the mapping cache. Useful when pricing data changes.
 */
export function clearMappingCache(): void {
	mappingCache.clear();
	cachedFingerprint = '';
}
