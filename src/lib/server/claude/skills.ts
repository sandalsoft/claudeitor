import { readdir, readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SkillInfo } from '../../data/types.js';
import { withSpan } from '../telemetry/span-helpers.js';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns the extracted key-value pairs and the body after the frontmatter.
 */
function parseFrontmatter(raw: string): { attrs: Record<string, string>; body: string } {
	const attrs: Record<string, string> = {};
	if (!raw.startsWith('---')) return { attrs, body: raw };

	const endIdx = raw.indexOf('\n---', 3);
	if (endIdx === -1) return { attrs, body: raw };

	const frontmatter = raw.slice(4, endIdx);
	const body = raw.slice(endIdx + 4).trimStart();

	for (const line of frontmatter.split('\n')) {
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const value = line.slice(colonIdx + 1).trim();
		if (key && value) {
			attrs[key] = value;
		}
	}

	return { attrs, body };
}

/**
 * Count files in a directory (non-recursive, files only).
 */
async function countFiles(dirPath: string): Promise<number> {
	try {
		const entries = await readdir(dirPath, { withFileTypes: true });
		return entries.filter((e) => e.isFile()).length;
	} catch {
		return 0;
	}
}

export async function readSkills(claudeDir = DEFAULT_CLAUDE_DIR): Promise<SkillInfo[]> {
	return withSpan(
		'op:readSkills',
		{
			'code.filepath': 'src/lib/server/claude/skills.ts',
			'data.source': 'skills/'
		},
		async () => {
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

					// Read SKILL.md for metadata
					const skillMdPath = join(fullPath, 'SKILL.md');
					let description: string | undefined;
					let disableModelInvocation = false;
					let content: string | undefined;

					try {
						const raw = await readFile(skillMdPath, 'utf-8');
						const { attrs } = parseFrontmatter(raw);
						description = attrs['description'] || undefined;
						disableModelInvocation = attrs['disable-model-invocation'] === 'true';
						content = raw;
					} catch {
						// SKILL.md might not exist
					}

					const fileCount = await countFiles(fullPath);

					skills.push({
						name: entry.name,
						path: fullPath,
						isSymlink,
						description,
						disableModelInvocation,
						fileCount,
						content
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
	);
}
