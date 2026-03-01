import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SkillInfo } from '../../data/types.js';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

export async function readSkills(claudeDir = DEFAULT_CLAUDE_DIR): Promise<SkillInfo[]> {
	const skillsDir = join(claudeDir, 'skills');
	try {
		const entries = await readdir(skillsDir, { withFileTypes: true });
		const skills: SkillInfo[] = [];

		for (const entry of entries) {
			if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

			const fullPath = join(skillsDir, entry.name);
			let isSymlink = false;

			try {
				const stat = await lstat(fullPath);
				isSymlink = stat.isSymbolicLink();
			} catch {
				// If stat fails, assume not symlink
			}

			skills.push({
				name: entry.name,
				path: fullPath,
				isSymlink
			});
		}

		return skills.sort((a, b) => a.name.localeCompare(b.name));
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return [];
		}
		console.warn('[skills] Failed to read skills directory:', (err as Error).message);
		return [];
	}
}
