import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SkillInfo } from '../types.js';

const SKILLS_DIR = join(homedir(), '.claude', 'skills');

export async function readSkills(): Promise<SkillInfo[]> {
	try {
		const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
		const skills: SkillInfo[] = [];

		for (const entry of entries) {
			if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

			const fullPath = join(SKILLS_DIR, entry.name);
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
