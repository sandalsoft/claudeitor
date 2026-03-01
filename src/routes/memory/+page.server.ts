import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { readMemoryFiles } from '$lib/server/claude/memory';

export const load: PageServerLoad = async () => {
	const config = await readConfig();
	const files = await readMemoryFiles(config.claudeDir);

	return { files };
};
