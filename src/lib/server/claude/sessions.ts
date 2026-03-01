import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SessionEntry } from '../../data/types.js';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

export async function readSessionHistory(claudeDir = DEFAULT_CLAUDE_DIR): Promise<SessionEntry[]> {
	try {
		const raw = await readFile(join(claudeDir, 'history.jsonl'), 'utf-8');
		const entries: SessionEntry[] = [];

		for (const line of raw.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			try {
				entries.push(JSON.parse(trimmed) as SessionEntry);
			} catch {
				// Skip malformed lines
			}
		}

		return entries;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return [];
		}
		console.warn('[sessions] Failed to read history.jsonl:', (err as Error).message);
		return [];
	}
}
