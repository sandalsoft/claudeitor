import type { CostCache, PricingData, ModelPricing, TokenUsage } from '../../data/types.js';
import { mapModelId } from './model-mapping.js';

export interface ModelCost {
	modelId: string;
	pricingKey: string;
	totalCostUSD: number;
	inputCostUSD: number;
	outputCostUSD: number;
	cacheReadCostUSD: number;
	cacheWriteCostUSD: number;
	totalTokens: number;
}

export interface DailyCost {
	date: string;
	totalCostUSD: number;
	byModel: Record<string, number>;
}

export interface CostSummary {
	totalCostUSD: number;
	byModel: ModelCost[];
	daily: DailyCost[];
	unknownModels: string[];
}

/**
 * Pricing rates are per-million tokens.
 * Convert to cost for a given token count.
 */
function tokenCost(tokens: number, ratePerMillion: number): number {
	return (tokens / 1_000_000) * ratePerMillion;
}

/**
 * Calculate cost for a single model's token usage against its pricing.
 */
function calculateModelTokenCost(usage: TokenUsage, pricing: ModelPricing): {
	inputCostUSD: number;
	outputCostUSD: number;
	cacheReadCostUSD: number;
	cacheWriteCostUSD: number;
} {
	return {
		inputCostUSD: tokenCost(usage.input, pricing.input),
		outputCostUSD: tokenCost(usage.output, pricing.output),
		cacheReadCostUSD: tokenCost(usage.cacheRead, pricing.cacheRead),
		cacheWriteCostUSD: tokenCost(usage.cacheWrite, pricing.cacheWrite)
	};
}

/**
 * Calculate per-model costs from CostCache + PricingData.
 * Handles missing models by logging a warning and showing $0.
 */
export function calculateCosts(costCache: CostCache, pricing: PricingData): CostSummary {
	const modelAgg = new Map<
		string,
		{
			pricingKey: string;
			inputCostUSD: number;
			outputCostUSD: number;
			cacheReadCostUSD: number;
			cacheWriteCostUSD: number;
			totalTokens: number;
		}
	>();
	const unknownModels = new Set<string>();
	const daily: DailyCost[] = [];

	const sortedDays = Object.keys(costCache.days).sort();

	for (const date of sortedDays) {
		const dayModels = costCache.days[date];
		let dayTotal = 0;
		const dayByModel: Record<string, number> = {};

		for (const [rawModelId, usage] of Object.entries(dayModels)) {
			const pricingKey = mapModelId(rawModelId, pricing);
			const modelPricing = pricing.models[pricingKey];

			const totalTokens = usage.input + usage.output + usage.cacheRead + usage.cacheWrite;

			if (!modelPricing) {
				unknownModels.add(rawModelId);
				// Aggregate with zero cost
				const existing = modelAgg.get(rawModelId);
				if (existing) {
					existing.totalTokens += totalTokens;
				} else {
					modelAgg.set(rawModelId, {
						pricingKey: rawModelId,
						inputCostUSD: 0,
						outputCostUSD: 0,
						cacheReadCostUSD: 0,
						cacheWriteCostUSD: 0,
						totalTokens
					});
				}
				continue;
			}

			const costs = calculateModelTokenCost(usage, modelPricing);
			const modelTotal =
				costs.inputCostUSD + costs.outputCostUSD + costs.cacheReadCostUSD + costs.cacheWriteCostUSD;

			dayTotal += modelTotal;
			dayByModel[pricingKey] = (dayByModel[pricingKey] ?? 0) + modelTotal;

			const existing = modelAgg.get(pricingKey);
			if (existing) {
				existing.inputCostUSD += costs.inputCostUSD;
				existing.outputCostUSD += costs.outputCostUSD;
				existing.cacheReadCostUSD += costs.cacheReadCostUSD;
				existing.cacheWriteCostUSD += costs.cacheWriteCostUSD;
				existing.totalTokens += totalTokens;
			} else {
				modelAgg.set(pricingKey, {
					pricingKey,
					inputCostUSD: costs.inputCostUSD,
					outputCostUSD: costs.outputCostUSD,
					cacheReadCostUSD: costs.cacheReadCostUSD,
					cacheWriteCostUSD: costs.cacheWriteCostUSD,
					totalTokens
				});
			}
		}

		daily.push({ date, totalCostUSD: dayTotal, byModel: dayByModel });
	}

	// Warn about unknown models
	for (const model of unknownModels) {
		console.warn(`[cost-calculator] No pricing found for model "${model}", showing $0 cost`);
	}

	const byModel: ModelCost[] = [];
	let totalCostUSD = 0;

	for (const [modelId, agg] of modelAgg) {
		const modelTotal =
			agg.inputCostUSD + agg.outputCostUSD + agg.cacheReadCostUSD + agg.cacheWriteCostUSD;
		totalCostUSD += modelTotal;
		byModel.push({
			modelId,
			pricingKey: agg.pricingKey,
			totalCostUSD: modelTotal,
			inputCostUSD: agg.inputCostUSD,
			outputCostUSD: agg.outputCostUSD,
			cacheReadCostUSD: agg.cacheReadCostUSD,
			cacheWriteCostUSD: agg.cacheWriteCostUSD,
			totalTokens: agg.totalTokens
		});
	}

	// Sort by cost descending
	byModel.sort((a, b) => b.totalCostUSD - a.totalCostUSD);

	return { totalCostUSD, byModel, daily, unknownModels: [...unknownModels] };
}

/**
 * Calculate daily cost array for trend charts.
 * Convenience wrapper that returns just the daily portion.
 */
export function calculateDailyCosts(costCache: CostCache, pricing: PricingData): DailyCost[] {
	return calculateCosts(costCache, pricing).daily;
}
