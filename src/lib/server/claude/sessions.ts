import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SessionEntry } from '../../data/types.js';
import { withSpan } from '../telemetry/span-helpers.js';

const DEFAULT_CLAUDE_DIR = join(homedir(), '.claude');

export async function readSessionHistory(claudeDir = DEFAULT_CLAUDE_DIR): Promise<SessionEntry[]> {
	return withSpan(
		'op:readSessionHistory',
		{
			'code.filepath': 'src/lib/server/claude/sessions.ts',
			'data.source': 'history.jsonl'
		},
		async () => {
			try {
				const raw = await readFile(join(claudeDir, 'history.jsonl'), 'utf-8');
				const entries: SessionEntry[] = [];
				let malformedCount = 0;

				for (const line of raw.split('\n')) {
					const trimmed = line.trim();
					if (!trimmed) continue;

					try {
						entries.push(JSON.parse(trimmed) as SessionEntry);
					} catch {
						malformedCount++;
					}
				}

				if (malformedCount > 0) {
					console.warn(
						`[sessions] Skipped ${malformedCount} malformed line(s) in history.jsonl`
					);
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
	);
}
