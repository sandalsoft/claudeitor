import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentInfo } from '../../data/types.js';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

export async function readAgents(claudeDir = DEFAULT_CLAUDE_DIR): Promise<AgentInfo[]> {
	const agentsDir = join(claudeDir, 'agents');
	try {
		const entries = await readdir(agentsDir, { withFileTypes: true });
		const agents: AgentInfo[] = [];

		for (const entry of entries) {
			if (!entry.isFile()) continue;

			const fullPath = join(agentsDir, entry.name);

			try {
				const content = await readFile(fullPath, 'utf-8');
				agents.push({
					name: entry.name.replace(/\.(md|txt)$/, ''),
					path: fullPath,
					content
				});
			} catch {
				// Skip unreadable files
			}
		}

		return agents.sort((a, b) => a.name.localeCompare(b.name));
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return [];
		}
		console.warn('[agents] Failed to read agents directory:', (err as Error).message);
		return [];
	}
}
