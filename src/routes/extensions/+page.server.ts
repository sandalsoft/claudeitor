import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { readSkills } from '$lib/server/claude/skills';
import { readAgents } from '$lib/server/claude/agents';
import { readSettings } from '$lib/server/claude/settings';
import type { ExtensionsSummary, PluginSummary } from '$lib/data/types';
import { withSpan } from '$lib/server/telemetry/span-helpers';
import { warn } from '$lib/server/telemetry/logger';

interface InstalledPluginEntry {
	scope: string;
	version: string;
	installedAt: string;
}

interface InstalledPluginsFile {
	version: number;
	plugins: Record<string, InstalledPluginEntry[]>;
}

/** Read installed_plugins.json from the plugins directory. */
async function readInstalledPlugins(claudeDir: string): Promise<InstalledPluginsFile | null> {
	try {
		const raw = await readFile(join(claudeDir, 'plugins', 'installed_plugins.json'), 'utf-8');
		return JSON.parse(raw) as InstalledPluginsFile;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
			warn('extensions', 'Failed to read installed_plugins.json', {
				'error.type': (err as Error).name
			});
		}
		return null;
	}
}

/** Count MCP servers from raw settings.json (may have fields not in SettingsData). */
async function readMcpServers(
	claudeDir: string
): Promise<{ count: number; names: string[] }> {
	try {
		const raw = await readFile(join(claudeDir, 'settings.json'), 'utf-8');
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const mcpServers = parsed.mcpServers;
		if (mcpServers && typeof mcpServers === 'object' && !Array.isArray(mcpServers)) {
			const names = Object.keys(mcpServers as Record<string, unknown>);
			return { count: names.length, names };
		}
		return { count: 0, names: [] };
	} catch {
		return { count: 0, names: [] };
	}
}

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:extensions',
		{
			'code.filepath': 'src/routes/extensions/+page.server.ts',
			'http.route': '/extensions'
		},
		async () => {
			const config = await readConfig();

			const [skills, agents, settings, installedPlugins, mcpServers] = await Promise.all([
				readSkills(config.claudeDir),
				readAgents(config.claudeDir),
				readSettings(config.claudeDir),
				readInstalledPlugins(config.claudeDir),
				readMcpServers(config.claudeDir)
			]);

			// Build plugin list by merging installed_plugins.json with enabledPlugins
			const plugins: PluginSummary[] = [];

			if (installedPlugins) {
				for (const [id, entries] of Object.entries(installedPlugins.plugins)) {
					// Use the most recent installation entry
					const latest = entries[entries.length - 1];
					if (!latest) continue;

					// Check enabledPlugins: explicit true/false, or default to true if installed
					const enabled = settings.enabledPlugins[id] !== false;

					plugins.push({
						id,
						enabled,
						version: latest.version || 'unknown',
						scope: latest.scope || 'user',
						installedAt: latest.installedAt || ''
					});
				}
			}

			// Also include any plugins in enabledPlugins that aren't in installed_plugins.json
			for (const [id, enabled] of Object.entries(settings.enabledPlugins)) {
				if (!plugins.some((p) => p.id === id)) {
					plugins.push({
						id,
						enabled,
						version: 'unknown',
						scope: 'user',
						installedAt: ''
					});
				}
			}

			plugins.sort((a, b) => a.id.localeCompare(b.id));

			// Aggregate hook count from Record<string, HookMatcher[]>
			const hookCount = Object.values(settings.hooks).reduce(
				(sum, matchers) => sum + matchers.length,
				0
			);

			const summary: ExtensionsSummary = {
				skillCount: skills.length,
				agentCount: agents.length,
				plugins,
				mcpServerCount: mcpServers.count,
				mcpServerNames: mcpServers.names,
				hookCount
			};

			return { summary };
		}
	);
};
