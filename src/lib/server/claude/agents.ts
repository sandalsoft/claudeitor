import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentInfo } from '../../data/types.js';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns key-value pairs and the body after the frontmatter.
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

export async function readAgents(claudeDir = DEFAULT_CLAUDE_DIR): Promise<AgentInfo[]> {
	const agentsDir = join(claudeDir, 'agents');
	try {
		const entries = await readdir(agentsDir, { withFileTypes: true });
		const agents: AgentInfo[] = [];

		for (const entry of entries) {
			if (!entry.isFile()) continue;

			const fullPath = join(agentsDir, entry.name);

			try {
				const raw = await readFile(fullPath, 'utf-8');
				const { attrs } = parseFrontmatter(raw);

				// Parse tools list (comma-separated in frontmatter)
				const toolsRaw = attrs['tools'];
				const tools = toolsRaw
					? toolsRaw.split(',').map((t) => t.trim()).filter(Boolean)
					: undefined;

				agents.push({
					name: attrs['name'] || entry.name.replace(/\.(md|txt)$/, ''),
					path: fullPath,
					content: raw,
					description: attrs['description'] || undefined,
					model: attrs['model'] || undefined,
					tools,
					color: attrs['color'] || undefined
				});
			} catch (readErr) {
				console.warn(
					`[agents] Failed to read agent file "${entry.name}":`,
					(readErr as Error).message
				);
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
