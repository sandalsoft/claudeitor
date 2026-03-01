import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SettingsData } from '../../data/types.js';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

const EMPTY_SETTINGS: SettingsData = {
	env: {},
	model: '',
	hooks: {},
	enabledPlugins: {}
};

export async function readSettings(claudeDir = DEFAULT_CLAUDE_DIR): Promise<SettingsData> {
	try {
		const raw = await readFile(join(claudeDir, 'settings.json'), 'utf-8');
		return JSON.parse(raw) as SettingsData;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return EMPTY_SETTINGS;
		}
		console.warn('[settings] Failed to parse settings.json:', (err as Error).message);
		return EMPTY_SETTINGS;
	}
}
