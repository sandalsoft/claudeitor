import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { readAgents } from '$lib/server/claude/agents';

export const load: PageServerLoad = async () => {
	const config = await readConfig();
	const agents = await readAgents(config.claudeDir);

	return { agents };
};
