import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SettingsData } from '../types.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_FILE = join(CLAUDE_DIR, 'settings.json');

const EMPTY_SETTINGS: SettingsData = {
	env: {},
	model: '',
	hooks: {},
	enabledPlugins: {}
};

export async function readSettings(): Promise<SettingsData> {
	try {
		const raw = await readFile(SETTINGS_FILE, 'utf-8');
		return JSON.parse(raw) as SettingsData;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return EMPTY_SETTINGS;
		}
		console.warn('[settings] Failed to parse settings.json:', (err as Error).message);
		return EMPTY_SETTINGS;
	}
}
