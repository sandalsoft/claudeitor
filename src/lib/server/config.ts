import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface ClaudeitorConfig {
	claudeDir: string;
	repoDirs: string[];
	anthropicApiKey: string;
	aiModel: string;
	costAlertThreshold: number;
	refreshInterval: number;
}

function defaultConfig(): ClaudeitorConfig {
	return {
		claudeDir: join(homedir(), '.claude'),
		repoDirs: [],
		anthropicApiKey: '',
		aiModel: 'claude-sonnet-4-5-20250929',
		costAlertThreshold: 50,
		refreshInterval: 30_000
	};
}

/**
 * Expand tilde (~) to the user's home directory.
 */
function expandTilde(p: string): string {
	if (p === '~') return homedir();
	if (p.startsWith('~/')) return join(homedir(), p.slice(2));
	return p;
}

/**
 * Read claudeitor.config.json from the project root.
 * Returns sensible defaults when the config file is missing.
 * Expands ~ in path values.
 */
export async function readConfig(projectRoot?: string): Promise<ClaudeitorConfig> {
	const root = projectRoot ?? process.cwd();
	const configPath = join(root, 'claudeitor.config.json');
	const defaults = defaultConfig();

	try {
		const raw = await readFile(configPath, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<ClaudeitorConfig>;

		return {
			claudeDir: expandTilde(parsed.claudeDir ?? defaults.claudeDir),
			repoDirs: (parsed.repoDirs ?? defaults.repoDirs).map(expandTilde),
			anthropicApiKey: parsed.anthropicApiKey ?? defaults.anthropicApiKey,
			aiModel: parsed.aiModel ?? defaults.aiModel,
			costAlertThreshold: parsed.costAlertThreshold ?? defaults.costAlertThreshold,
			refreshInterval: parsed.refreshInterval ?? defaults.refreshInterval
		};
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return defaults;
		}
		console.warn('[config] Failed to parse claudeitor.config.json:', (err as Error).message);
		return defaults;
	}
}
