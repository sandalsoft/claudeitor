import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { readSkills } from '$lib/server/claude/skills';

export const load: PageServerLoad = async () => {
	const config = await readConfig();
	const skills = await readSkills(config.claudeDir);

	return { skills };
};
