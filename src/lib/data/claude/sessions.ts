import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SessionEntry } from '../types.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const HISTORY_FILE = join(CLAUDE_DIR, 'history.jsonl');

export async function readSessionHistory(): Promise<SessionEntry[]> {
	try {
		const raw = await readFile(HISTORY_FILE, 'utf-8');
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
