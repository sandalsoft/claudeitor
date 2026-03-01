import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { readMemoryFiles } from '$lib/server/claude/memory';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:memory',
		{
			'code.filepath': 'src/routes/memory/+page.server.ts',
			'http.route': '/memory'
		},
		async () => {
			const config = await readConfig();
			const files = await readMemoryFiles(config.claudeDir);

			return { files };
		}
	);
};
