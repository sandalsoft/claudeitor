import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentInfo } from '../types.js';

const AGENTS_DIR = join(homedir(), '.claude', 'agents');

export async function readAgents(): Promise<AgentInfo[]> {
	try {
		const entries = await readdir(AGENTS_DIR, { withFileTypes: true });
		const agents: AgentInfo[] = [];

		for (const entry of entries) {
			if (!entry.isFile()) continue;

			const fullPath = join(AGENTS_DIR, entry.name);

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
