import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { EnvVariable } from '$lib/data/types';
import { warn } from '$lib/server/telemetry/logger';

/**
 * Broad pattern matching env-style KEY=value lines.
 * Handles optional spaces around `=`, skips comments and blank lines.
 * Captures the key name only -- values are NEVER extracted.
 */
const ENV_LINE_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/;

/** File patterns that typically contain environment variables. */
const ENV_FILE_PATTERNS = [
	/^\.env$/,
	/^\.env\..+$/, // .env.local, .env.development, etc.
	/^\.env\.example$/,
	/^\.env\.sample$/
];

/**
 * Read env file names from a single file's content.
 * Returns an array of unique variable names. Never reads values.
 */
export function parseEnvFileKeys(content: string): string[] {
	const keys = new Set<string>();
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		// Skip comments and blank lines
		if (!trimmed || trimmed.startsWith('#')) continue;
		const match = trimmed.match(ENV_LINE_RE);
		if (match) {
			keys.add(match[1]);
		}
	}
	return [...keys];
}

/**
 * Check if a filename matches common env file patterns.
 */
export function isEnvFile(filename: string): boolean {
	return ENV_FILE_PATTERNS.some((re) => re.test(filename));
}

/**
 * Scan a single repo root for env files and extract variable NAMES.
 * Never returns or logs values.
 */
export async function scanRepoEnvKeys(repoPath: string): Promise<string[]> {
	const allKeys = new Set<string>();

	let entries;
	try {
		entries = await readdir(repoPath, { withFileTypes: true });
	} catch {
		return [];
	}

	for (const entry of entries) {
		if (!entry.isFile()) continue;
		if (!isEnvFile(entry.name)) continue;

		try {
			const content = await readFile(join(repoPath, entry.name), 'utf-8');
			for (const key of parseEnvFileKeys(content)) {
				allKeys.add(key);
			}
		} catch (err) {
			warn('env-reader', `Failed to read ${entry.name} in ${repoPath}`, {
				'error.type': (err as Error).name,
				'repo.path': repoPath,
				'file.name': entry.name
			});
		}
	}

	return [...allKeys];
}

/**
 * Scan all discovered repos for env variable names.
 * Uses scanRepos() results (repo.path), not raw repoDirs.
 *
 * @param repoPaths - Array of actual repo root paths (from scanRepos discovery)
 * @returns Aggregated env variables with the repos where each is defined
 */
export async function scanAllEnvKeys(repoPaths: string[]): Promise<EnvVariable[]> {
	const variableMap = new Map<string, Set<string>>();

	for (const repoPath of repoPaths) {
		const keys = await scanRepoEnvKeys(repoPath);
		const repoName = basename(repoPath);
		for (const key of keys) {
			if (!variableMap.has(key)) {
				variableMap.set(key, new Set());
			}
			variableMap.get(key)!.add(repoName);
		}
	}

	const variables: EnvVariable[] = [];
	for (const [name, repos] of variableMap) {
		variables.push({ name, repos: [...repos].sort() });
	}

	// Sort alphabetically by name
	variables.sort((a, b) => a.name.localeCompare(b.name));

	return variables;
}
