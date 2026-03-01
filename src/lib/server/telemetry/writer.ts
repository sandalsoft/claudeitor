import { appendFile, stat, rename, unlink, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_OLD_FILES = 3;

function isDisabled(): boolean {
	return (
		process.env.NODE_ENV === 'test' ||
		!!process.env.VITEST ||
		process.env.TELEMETRY_ENABLED === 'false'
	);
}

interface QueueEntry {
	data: string;
	resolve: () => void;
	reject: (err: unknown) => void;
}

class FileWriter {
	private filePath: string;
	private currentSize = -1; // -1 means uninitialized
	private queue: QueueEntry[] = [];
	private flushing = false;

	constructor(filePath: string) {
		this.filePath = filePath;
	}

	append(record: Record<string, unknown>): Promise<void> {
		if (isDisabled()) {
			return Promise.resolve();
		}

		const line = JSON.stringify(record) + '\n';

		return new Promise<void>((resolve, reject) => {
			this.queue.push({ data: line, resolve, reject });
			if (!this.flushing) {
				void this.flush();
			}
		});
	}

	private async flush(): Promise<void> {
		this.flushing = true;

		try {
			while (this.queue.length > 0) {
				const entry = this.queue.shift()!;

				try {
					await this.ensureInitialized();
					await this.maybeRotate();
					await appendFile(this.filePath, entry.data, 'utf-8');
					this.currentSize += Buffer.byteLength(entry.data, 'utf-8');
					entry.resolve();
				} catch (err) {
					entry.reject(err);
				}
			}
		} finally {
			this.flushing = false;
		}
	}

	private async ensureInitialized(): Promise<void> {
		if (this.currentSize >= 0) return;

		await mkdir(dirname(this.filePath), { recursive: true });

		try {
			const s = await stat(this.filePath);
			this.currentSize = s.size;
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
				this.currentSize = 0;
			} else {
				throw err;
			}
		}
	}

	private async maybeRotate(): Promise<void> {
		if (this.currentSize < MAX_FILE_SIZE) return;

		// Delete the oldest rotated file (e.g. .3)
		await this.safeUnlink(`${this.filePath}.${MAX_OLD_FILES}`);

		// Shift remaining: .2 -> .3, .1 -> .2
		for (let i = MAX_OLD_FILES - 1; i >= 1; i--) {
			await this.safeRename(`${this.filePath}.${i}`, `${this.filePath}.${i + 1}`);
		}

		// Rotate current file to .1
		await this.safeRename(this.filePath, `${this.filePath}.1`);

		this.currentSize = 0;
	}

	private async safeRename(src: string, dst: string): Promise<void> {
		try {
			await rename(src, dst);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw err;
			}
		}
	}

	private async safeUnlink(path: string): Promise<void> {
		try {
			await unlink(path);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw err;
			}
		}
	}
}

// Module-level singleton
const DEFAULT_TELEMETRY_DIR = join(process.cwd(), '.claudeitor');
const DEFAULT_TELEMETRY_FILE = join(DEFAULT_TELEMETRY_DIR, 'telemetry.jsonl');

let instance: FileWriter | null = null;

export function getFileWriter(filePath = DEFAULT_TELEMETRY_FILE): FileWriter {
	if (!instance) {
		instance = new FileWriter(filePath);
	}
	return instance;
}
