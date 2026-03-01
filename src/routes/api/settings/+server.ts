import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readConfig, writeConfig, defaultConfig, expandTilde } from '$lib/server/config';
import { readPricing } from '$lib/server/claude/costs';

/**
 * GET /api/settings
 *
 * Returns the current configuration with the API key redacted.
 * Client receives hasApiKey: boolean, never the actual key.
 */
export const GET: RequestHandler = async () => {
	const config = await readConfig();
	const pricing = await readPricing(config.claudeDir);
	const availableModels = Object.keys(pricing.models);

	return json({
		claudeDir: config.claudeDir,
		repoDirs: config.repoDirs,
		hasApiKey: config.anthropicApiKey.length > 0,
		aiModel: config.aiModel,
		costAlertThreshold: config.costAlertThreshold,
		refreshInterval: config.refreshInterval,
		themeOverride: config.themeOverride,
		availableModels
	});
};

/**
 * POST /api/settings
 *
 * Validates and writes config. API key is accepted here but never returned.
 * Write is atomic (temp file + rename).
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const current = await readConfig();
	const defaults = defaultConfig();

	// Validate repoDirs
	const repoDirs: string[] = Array.isArray(body.repoDirs)
		? body.repoDirs.filter((d: unknown) => typeof d === 'string' && d.trim().length > 0)
		: current.repoDirs;

	// Validate aiModel
	const aiModel =
		typeof body.aiModel === 'string' && body.aiModel.trim().length > 0
			? body.aiModel.trim()
			: current.aiModel;

	// Validate costAlertThreshold
	const costAlertThreshold =
		typeof body.costAlertThreshold === 'number' && body.costAlertThreshold >= 0
			? body.costAlertThreshold
			: current.costAlertThreshold;

	// Validate themeOverride
	const validThemes = ['system', 'light', 'dark'] as const;
	const themeOverride = validThemes.includes(body.themeOverride)
		? (body.themeOverride as (typeof validThemes)[number])
		: current.themeOverride;

	// Validate claudeDir
	const claudeDir =
		typeof body.claudeDir === 'string' && body.claudeDir.trim().length > 0
			? body.claudeDir.trim()
			: current.claudeDir;

	// API key: if provided and non-empty, update; if empty string, clear; otherwise keep current
	let anthropicApiKey = current.anthropicApiKey;
	if (typeof body.anthropicApiKey === 'string') {
		anthropicApiKey = body.anthropicApiKey;
	}

	// Validate refreshInterval
	const refreshInterval =
		typeof body.refreshInterval === 'number' && body.refreshInterval >= 1000
			? body.refreshInterval
			: current.refreshInterval;

	const newConfig = {
		claudeDir,
		repoDirs,
		anthropicApiKey,
		aiModel,
		costAlertThreshold,
		refreshInterval,
		themeOverride
	};

	try {
		await writeConfig(newConfig);

		return json({
			success: true,
			claudeDir: expandTilde(newConfig.claudeDir),
			repoDirs: newConfig.repoDirs.map(expandTilde),
			hasApiKey: newConfig.anthropicApiKey.length > 0,
			aiModel: newConfig.aiModel,
			costAlertThreshold: newConfig.costAlertThreshold,
			refreshInterval: newConfig.refreshInterval,
			themeOverride: newConfig.themeOverride
		});
	} catch (err) {
		console.error('[api/settings] Failed to write config:', (err as Error).message);
		return json({ success: false, error: 'Failed to save settings' }, { status: 500 });
	}
};
