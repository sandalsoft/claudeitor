import type { PageServerLoad } from './$types';
import { readConfig, expandTilde } from '$lib/server/config';
import { readPricing } from '$lib/server/claude/costs';

export const load: PageServerLoad = async () => {
	const config = await readConfig();
	const pricing = await readPricing(config.claudeDir);
	const availableModels = Object.keys(pricing.models);

	return {
		claudeDir: config.claudeDir,
		repoDirs: config.repoDirs,
		hasApiKey: config.anthropicApiKey.length > 0,
		aiModel: config.aiModel,
		costAlertThreshold: config.costAlertThreshold,
		refreshInterval: config.refreshInterval,
		themeOverride: config.themeOverride,
		availableModels,
		expandedRepoDirs: config.repoDirs.map(expandTilde)
	};
};
