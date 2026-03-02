import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnvFileKeys, isEnvFile, scanRepoEnvKeys, scanAllEnvKeys } from './reader.js';

// ─── parseEnvFileKeys (pure parsing, no I/O) ─────────────────

describe('parseEnvFileKeys', () => {
	it('extracts simple KEY=value pairs', () => {
		const keys = parseEnvFileKeys('DATABASE_URL=postgres://localhost\nPORT=3000');
		expect(keys).toEqual(['DATABASE_URL', 'PORT']);
	});

	it('handles spaces around equals sign', () => {
		const keys = parseEnvFileKeys('API_KEY = sk-test-123\nSECRET =hunter2');
		expect(keys).toEqual(['API_KEY', 'SECRET']);
	});

	it('skips comments and blank lines', () => {
		const keys = parseEnvFileKeys('# This is a comment\n\nDB_HOST=localhost\n  \n# Another comment');
		expect(keys).toEqual(['DB_HOST']);
	});

	it('deduplicates keys within same file', () => {
		const keys = parseEnvFileKeys('FOO=bar\nFOO=baz');
		expect(keys).toEqual(['FOO']);
	});

	it('handles keys with underscores and numbers', () => {
		const keys = parseEnvFileKeys('AWS_S3_BUCKET_2=my-bucket\n_PRIVATE=1');
		expect(keys).toEqual(['AWS_S3_BUCKET_2', '_PRIVATE']);
	});

	it('returns empty array for empty content', () => {
		expect(parseEnvFileKeys('')).toEqual([]);
	});

	it('returns empty array for comments-only file', () => {
		expect(parseEnvFileKeys('# just comments\n# nothing else')).toEqual([]);
	});

	it('ignores lines without valid key format', () => {
		const keys = parseEnvFileKeys('123INVALID=foo\n  =no-key\nVALID_KEY=yes');
		expect(keys).toEqual(['VALID_KEY']);
	});
});

// ─── isEnvFile ───────────────────────────────────────────────

describe('isEnvFile', () => {
	it('matches .env', () => {
		expect(isEnvFile('.env')).toBe(true);
	});

	it('matches .env.local', () => {
		expect(isEnvFile('.env.local')).toBe(true);
	});

	it('matches .env.development', () => {
		expect(isEnvFile('.env.development')).toBe(true);
	});

	it('matches .env.example', () => {
		expect(isEnvFile('.env.example')).toBe(true);
	});

	it('matches .env.sample', () => {
		expect(isEnvFile('.env.sample')).toBe(true);
	});

	it('does not match package.json', () => {
		expect(isEnvFile('package.json')).toBe(false);
	});

	it('does not match .envrc', () => {
		expect(isEnvFile('.envrc')).toBe(false);
	});

	it('does not match env without dot prefix', () => {
		expect(isEnvFile('env')).toBe(false);
	});
});

// ─── scanRepoEnvKeys (I/O with fixture dirs) ────────────────

let fixtureDir: string;

beforeAll(async () => {
	fixtureDir = await mkdtemp(join(tmpdir(), 'claudeitor-env-test-'));
});

afterAll(async () => {
	await rm(fixtureDir, { recursive: true, force: true });
});

describe('scanRepoEnvKeys', () => {
	it('finds keys from .env files in a repo', async () => {
		const repoDir = join(fixtureDir, 'repo-with-env');
		await mkdir(repoDir, { recursive: true });
		await writeFile(join(repoDir, '.env'), 'DB_HOST=localhost\nDB_PORT=5432');
		await writeFile(join(repoDir, '.env.example'), 'DB_HOST=\nAPI_KEY=');

		const keys = await scanRepoEnvKeys(repoDir);
		expect(keys).toContain('DB_HOST');
		expect(keys).toContain('DB_PORT');
		expect(keys).toContain('API_KEY');
	});

	it('returns empty array for repo without env files', async () => {
		const repoDir = join(fixtureDir, 'repo-no-env');
		await mkdir(repoDir, { recursive: true });
		await writeFile(join(repoDir, 'package.json'), '{}');

		const keys = await scanRepoEnvKeys(repoDir);
		expect(keys).toEqual([]);
	});

	it('returns empty array for nonexistent directory', async () => {
		const keys = await scanRepoEnvKeys(join(fixtureDir, 'nonexistent'));
		expect(keys).toEqual([]);
	});
});

// ─── scanAllEnvKeys (aggregation) ────────────────────────────

describe('scanAllEnvKeys', () => {
	it('aggregates keys across multiple repos', async () => {
		const repo1 = join(fixtureDir, 'multi-repo-1');
		const repo2 = join(fixtureDir, 'multi-repo-2');
		await mkdir(repo1, { recursive: true });
		await mkdir(repo2, { recursive: true });

		await writeFile(join(repo1, '.env'), 'SHARED_KEY=1\nONLY_IN_1=yes');
		await writeFile(join(repo2, '.env'), 'SHARED_KEY=2\nONLY_IN_2=yes');

		const variables = await scanAllEnvKeys([repo1, repo2]);

		const sharedVar = variables.find((v) => v.name === 'SHARED_KEY');
		expect(sharedVar).toBeDefined();
		expect(sharedVar!.repos).toHaveLength(2);

		const onlyIn1 = variables.find((v) => v.name === 'ONLY_IN_1');
		expect(onlyIn1).toBeDefined();
		expect(onlyIn1!.repos).toHaveLength(1);

		const onlyIn2 = variables.find((v) => v.name === 'ONLY_IN_2');
		expect(onlyIn2).toBeDefined();
		expect(onlyIn2!.repos).toHaveLength(1);
	});

	it('returns sorted results', async () => {
		const repo = join(fixtureDir, 'sorted-repo');
		await mkdir(repo, { recursive: true });
		await writeFile(join(repo, '.env'), 'ZEBRA=1\nAPPLE=2\nMIDDLE=3');

		const variables = await scanAllEnvKeys([repo]);
		const names = variables.map((v) => v.name);
		expect(names).toEqual(['APPLE', 'MIDDLE', 'ZEBRA']);
	});

	it('returns empty for no repos', async () => {
		const variables = await scanAllEnvKeys([]);
		expect(variables).toEqual([]);
	});
});
