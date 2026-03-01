import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { readSettings } from '$lib/server/claude/settings';

export interface HookGroup {
	trigger: string;
	matcherCount: number;
	hookCount: number;
	matchers: {
		matcher: string;
		hooks: { type: string; command: string }[];
	}[];
}

export const load: PageServerLoad = async () => {
	const config = await readConfig();
	const settings = await readSettings(config.claudeDir);

	const groups: HookGroup[] = [];

	for (const [trigger, matchers] of Object.entries(settings.hooks)) {
		const hookCount = matchers.reduce((sum, m) => sum + m.hooks.length, 0);
		groups.push({
			trigger,
			matcherCount: matchers.length,
			hookCount,
			matchers: matchers.map((m) => ({
				matcher: m.matcher,
				hooks: m.hooks.map((h) => ({ type: h.type, command: h.command }))
			}))
		});
	}

	// Sort: triggers with hooks first, then alphabetically
	groups.sort((a, b) => {
		if (a.hookCount > 0 && b.hookCount === 0) return -1;
		if (a.hookCount === 0 && b.hookCount > 0) return 1;
		return a.trigger.localeCompare(b.trigger);
	});

	const totalHooks = groups.reduce((sum, g) => sum + g.hookCount, 0);
	const activeTriggers = groups.filter((g) => g.hookCount > 0).length;

	return { groups, totalHooks, activeTriggers };
};
