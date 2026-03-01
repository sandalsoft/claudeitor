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
			const validRanges = [7, 14, 30, 90] as const;
			const range = validRanges.includes(Number(rangeParam) as (typeof validRanges)[number])
				? (Number(rangeParam) as (typeof validRanges)[number])
				: 30;

			// Use local-date arithmetic (DST-safe) for all date boundaries
			const now = new Date();
			const localDate = (d: Date) =>
				`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

			const todayStr = localDate(now);

			// DST-safe: use setDate() instead of millisecond subtraction
			const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			rangeStart.setDate(rangeStart.getDate() - (range - 1));
			const rangeStartStr = localDate(rangeStart);

			const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			weekStart.setDate(weekStart.getDate() - 6);
			const weekStartStr = localDate(weekStart);

			const monthStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			monthStart.setDate(monthStart.getDate() - 29);
			const monthStartStr = localDate(monthStart);

			// Filter daily costs by calendar date threshold (not entry count)
			const allDaily = costSummary.daily;
			const filteredDaily = allDaily.filter(
				(d) => d.date >= rangeStartStr && d.date <= todayStr
			);

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

			return {
				totalCost: costSummary.totalCostUSD,
				costToday,
				costThisWeek,
				costThisMonth,
				byModel: costSummary.byModel,
				daily: filteredDaily,
				tableRows,
				range
			};
		}
	);
};
