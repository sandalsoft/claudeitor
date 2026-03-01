import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { withSpan } from './telemetry/span-helpers.js';

export interface ClaudeitorConfig {
	claudeDir: string;
	repoDirs: string[];
	anthropicApiKey: string;
	aiModel: string;
	costAlertThreshold: number;
	refreshInterval: number;
	themeOverride: 'system' | 'light' | 'dark';
}

export function defaultConfig(): ClaudeitorConfig {
	return {
		claudeDir: join(homedir(), '.claude'),
		repoDirs: [],
		anthropicApiKey: '',
		aiModel: 'claude-sonnet-4-5-20250929',
		costAlertThreshold: 50,
		refreshInterval: 30_000,
		themeOverride: 'system'
	};
}

/**
 * Expand tilde (~) to the user's home directory.
 */
export function expandTilde(p: string): string {
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
	return withSpan(
		'op:readConfig',
		{
			'code.filepath': 'src/lib/server/config.ts',
			'data.source': 'claudeitor.config.json'
		},
		async () => {
			const root = projectRoot ?? process.cwd();
			const configPath = join(root, 'claudeitor.config.json');
			const defaults = defaultConfig();

			try {
				const raw = await readFile(configPath, 'utf-8');
				const parsed = JSON.parse(raw) as Partial<ClaudeitorConfig>;

				const themeRaw = parsed.themeOverride;
				const validThemes = ['system', 'light', 'dark'] as const;
				const themeOverride = validThemes.includes(themeRaw as (typeof validThemes)[number])
					? (themeRaw as ClaudeitorConfig['themeOverride'])
					: defaults.themeOverride;

				return {
					claudeDir: expandTilde(parsed.claudeDir ?? defaults.claudeDir),
					repoDirs: (parsed.repoDirs ?? defaults.repoDirs).map(expandTilde),
					anthropicApiKey: parsed.anthropicApiKey ?? defaults.anthropicApiKey,
					aiModel: parsed.aiModel ?? defaults.aiModel,
					costAlertThreshold: parsed.costAlertThreshold ?? defaults.costAlertThreshold,
					refreshInterval: parsed.refreshInterval ?? defaults.refreshInterval,
					themeOverride
				};
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
					return defaults;
				}
				console.warn(
					'[config] Failed to parse claudeitor.config.json:',
					(err as Error).message
				);
				return defaults;
			}
		}
	);
}

/**
 * Write claudeitor.config.json atomically (write temp file, then rename).
 * The config is stored as-is; API key is the caller's responsibility to validate.
 */
export async function writeConfig(
	config: ClaudeitorConfig,
	projectRoot?: string
): Promise<void> {
	const root = projectRoot ?? process.cwd();
	const configPath = join(root, 'claudeitor.config.json');
	const tmpSuffix = randomBytes(6).toString('hex');
	const tmpPath = join(root, `.claudeitor.config.tmp.${tmpSuffix}`);

	const json = JSON.stringify(config, null, '\t') + '\n';
	await writeFile(tmpPath, json, 'utf-8');
	await rename(tmpPath, configPath);
}
