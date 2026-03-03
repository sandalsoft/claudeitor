import type { PageServerLoad } from './$types';
import { readCostCache, readPricing } from '$lib/server/claude/costs';
import { readConfig } from '$lib/server/config';
import { calculateCosts } from '$lib/server/claude/cost-calculator';
import { mapModelId } from '$lib/server/claude/model-mapping';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export const load: PageServerLoad = async ({ url }) => {
	return withSpan(
		'load:costs',
		{
			'code.filepath': 'src/routes/costs/+page.server.ts',
			'http.route': '/costs'
		},
		async () => {
			const config = await readConfig();
			const [costCache, pricing] = await Promise.all([
				readCostCache(config.claudeDir),
				readPricing(config.claudeDir)
			]);

			const costSummary = calculateCosts(costCache, pricing);

			// Date range filter from query params (default 30 days)
			const rangeParam = url.searchParams.get('range');
			const validRanges = [0, 1, 7, 30] as const;
			const range = validRanges.includes(Number(rangeParam) as (typeof validRanges)[number])
				? (Number(rangeParam) as (typeof validRanges)[number])
				: 30;

			// Use local-date arithmetic (DST-safe) for all date boundaries
			const now = new Date();
			const localDate = (d: Date) =>
				`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

			const todayStr = localDate(now);

			const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			weekStart.setDate(weekStart.getDate() - 6);
			const weekStartStr = localDate(weekStart);

			const monthStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			monthStart.setDate(monthStart.getDate() - 29);
			const monthStartStr = localDate(monthStart);

			// Filter daily costs by calendar date threshold (not entry count)
			// range=0 means "All Time" — no filtering
			const allDaily = costSummary.daily;
			let filteredDaily: typeof allDaily;

			if (range === 0) {
				filteredDaily = allDaily;
			} else {
				const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
				rangeStart.setDate(rangeStart.getDate() - (range - 1));
				const rangeStartStr = localDate(rangeStart);
				filteredDaily = allDaily.filter(
					(d) => d.date >= rangeStartStr && d.date <= todayStr
				);
			}

			let costToday = 0;
			let costThisWeek = 0;
			let costThisMonth = 0;

			for (const day of allDaily) {
				if (day.date === todayStr) costToday += day.totalCostUSD;
				if (day.date >= weekStartStr && day.date <= todayStr)
					costThisWeek += day.totalCostUSD;
				if (day.date >= monthStartStr && day.date <= todayStr)
					costThisMonth += day.totalCostUSD;
			}

			// Build detailed table rows: aggregate tokens by pricing key per day
			interface TableRow {
				date: string;
				model: string;
				inputTokens: number;
				outputTokens: number;
				cacheTokens: number;
				cost: number;
			}

			const tableRows: TableRow[] = [];

			for (const day of filteredDaily) {
				const dayModels = costCache.days[day.date];
				if (!dayModels) continue;

				// Aggregate by pricing key for this day
				const byKey = new Map<
					string,
					{ input: number; output: number; cache: number; cost: number }
				>();

				for (const [rawModelId, usage] of Object.entries(dayModels)) {
					const pricingKey = mapModelId(rawModelId, pricing);
					const existing = byKey.get(pricingKey);
					const dayCost = day.byModel[pricingKey] ?? 0;

					if (existing) {
						existing.input += usage.input;
						existing.output += usage.output;
						existing.cache += usage.cacheRead + usage.cacheWrite;
					} else {
						byKey.set(pricingKey, {
							input: usage.input,
							output: usage.output,
							cache: usage.cacheRead + usage.cacheWrite,
							cost: dayCost
						});
					}
				}

				for (const [model, agg] of byKey) {
					tableRows.push({
						date: day.date,
						model,
						inputTokens: agg.input,
						outputTokens: agg.output,
						cacheTokens: agg.cache,
						cost: agg.cost
					});
				}
			}

			// Compute range-scoped byModel with full cost breakdown from raw token data
			interface ModelAgg {
				pricingKey: string;
				inputCostUSD: number;
				outputCostUSD: number;
				cacheReadCostUSD: number;
				cacheWriteCostUSD: number;
				totalTokens: number;
			}

			const filteredModelAgg = new Map<string, ModelAgg>();
			let rangeTotalCost = 0;

			for (const day of filteredDaily) {
				rangeTotalCost += day.totalCostUSD;
				const dayModels = costCache.days[day.date];
				if (!dayModels) continue;

				for (const [rawModelId, usage] of Object.entries(dayModels)) {
					const pricingKey = mapModelId(rawModelId, pricing);
					const modelPricing = pricing.models[pricingKey];
					const totalTokens = usage.input + usage.output + usage.cacheRead + usage.cacheWrite;

					let inputCost = 0;
					let outputCost = 0;
					let cacheReadCost = 0;
					let cacheWriteCost = 0;

					if (modelPricing) {
						inputCost = (usage.input / 1_000_000) * modelPricing.input;
						outputCost = (usage.output / 1_000_000) * modelPricing.output;
						cacheReadCost = (usage.cacheRead / 1_000_000) * modelPricing.cacheRead;
						cacheWriteCost = (usage.cacheWrite / 1_000_000) * modelPricing.cacheWrite;
					}

					const existing = filteredModelAgg.get(pricingKey);
					if (existing) {
						existing.inputCostUSD += inputCost;
						existing.outputCostUSD += outputCost;
						existing.cacheReadCostUSD += cacheReadCost;
						existing.cacheWriteCostUSD += cacheWriteCost;
						existing.totalTokens += totalTokens;
					} else {
						filteredModelAgg.set(pricingKey, {
							pricingKey,
							inputCostUSD: inputCost,
							outputCostUSD: outputCost,
							cacheReadCostUSD: cacheReadCost,
							cacheWriteCostUSD: cacheWriteCost,
							totalTokens
						});
					}
				}
			}

			const byModel = [...filteredModelAgg.values()]
				.map((agg) => ({
					modelId: agg.pricingKey,
					pricingKey: agg.pricingKey,
					totalCostUSD:
						agg.inputCostUSD + agg.outputCostUSD + agg.cacheReadCostUSD + agg.cacheWriteCostUSD,
					inputCostUSD: agg.inputCostUSD,
					outputCostUSD: agg.outputCostUSD,
					cacheReadCostUSD: agg.cacheReadCostUSD,
					cacheWriteCostUSD: agg.cacheWriteCostUSD,
					totalTokens: agg.totalTokens
				}))
				.sort((a, b) => b.totalCostUSD - a.totalCostUSD);

			return {
				totalCost: rangeTotalCost,
				costToday,
				costThisWeek,
				costThisMonth,
				byModel,
				daily: filteredDaily,
				allDaily,
				tableRows,
				range
			};
		}
	);
};
