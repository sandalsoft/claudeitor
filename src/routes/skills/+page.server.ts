import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { readSkills } from '$lib/server/claude/skills';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:skills',
		{
			'code.filepath': 'src/routes/skills/+page.server.ts',
			'http.route': '/skills'
		},
		async () => {
			const config = await readConfig();
			const skills = await readSkills(config.claudeDir);

			return { skills };
		}
	);
};
