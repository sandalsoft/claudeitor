import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { MemoryFile } from '../../data/types.js';
import { withSpan } from '../telemetry/span-helpers.js';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

/**
 * Read a single CLAUDE.md file if it exists.
 */
async function readMemoryFile(
	filePath: string,
	label: string,
	scope: MemoryFile['scope']
): Promise<MemoryFile | null> {
	try {
		const content = await readFile(filePath, 'utf-8');
		const lineCount = content.split('\n').length;
		return { label, path: filePath, content, lineCount, scope };
	} catch {
		return null;
	}
}

/**
 * Scan a directory for CLAUDE.md files in child directories.
 */
async function scanChildMemory(projectDir: string): Promise<MemoryFile[]> {
	const results: MemoryFile[] = [];

	try {
		const entries = await readdir(projectDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			// Skip hidden directories and node_modules
			if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

			const childPath = join(projectDir, entry.name, 'CLAUDE.md');
			const file = await readMemoryFile(
				childPath,
				`${entry.name}/CLAUDE.md`,
				'child'
			);
			if (file) results.push(file);
		}
	} catch {
		// Directory might not exist or be readable
	}

	return results;
}

/**
 * Read all CLAUDE.md memory files: global, project-level, and child directories.
 */
export async function readMemoryFiles(
	claudeDir = DEFAULT_CLAUDE_DIR,
	projectDir = process.cwd()
): Promise<MemoryFile[]> {
	return withSpan(
		'op:readMemoryFiles',
		{
			'code.filepath': 'src/lib/server/claude/memory.ts',
			'data.source': 'CLAUDE.md'
		},
		async () => {
			const files: MemoryFile[] = [];

			// 1. Global CLAUDE.md
			const globalFile = await readMemoryFile(
				join(claudeDir, 'CLAUDE.md'),
				'Global (~/.claude/CLAUDE.md)',
				'global'
			);
			if (globalFile) files.push(globalFile);

			// 2. Project-level CLAUDE.md
			const projectFile = await readMemoryFile(
				join(projectDir, 'CLAUDE.md'),
				'Project (./CLAUDE.md)',
				'project'
			);
			if (projectFile) files.push(projectFile);

			// 3. Project-level CLAUDE.local.md
			const localFile = await readMemoryFile(
				join(projectDir, 'CLAUDE.local.md'),
				'Local (./CLAUDE.local.md)',
				'project'
			);
			if (localFile) files.push(localFile);

			// 4. Child directory CLAUDE.md files (one level deep)
			const children = await scanChildMemory(projectDir);
			files.push(...children);

			return files;
		}
	);
}
