import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { readAgents } from '$lib/server/claude/agents';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:agents',
		{
			'code.filepath': 'src/routes/agents/+page.server.ts',
			'http.route': '/agents'
		},
		async () => {
			const config = await readConfig();
			const agents = await readAgents(config.claudeDir);

			return { agents };
		}
	);
};
