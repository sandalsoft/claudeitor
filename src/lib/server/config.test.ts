import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { readConfig, writeConfig, expandTilde, defaultConfig } from './config.js';

let fixtureDir: string;

beforeAll(async () => {
	fixtureDir = await mkdtemp(join(tmpdir(), 'claudeitor-config-test-'));
});

afterAll(async () => {
	await rm(fixtureDir, { recursive: true, force: true });
});

describe('readConfig', () => {
	it('returns defaults when config file is missing', async () => {
		const config = await readConfig(fixtureDir);
		expect(config.claudeDir).toBe(join(homedir(), '.claude'));
		expect(config.repoDirs).toEqual([]);
		expect(config.anthropicApiKey).toBe('');
		expect(config.aiModel).toBe('claude-sonnet-4-5-20250929');
		expect(config.costAlertThreshold).toBe(50);
		expect(config.refreshInterval).toBe(30_000);
	});

	it('reads config from file', async () => {
		await writeFile(
			join(fixtureDir, 'claudeitor.config.json'),
			JSON.stringify({
				claudeDir: '~/.claude',
				repoDirs: ['~/projects', '/absolute/path'],
				anthropicApiKey: 'sk-test',
				aiModel: 'claude-opus-4-5-20251101',
				costAlertThreshold: 100,
				refreshInterval: 60000
			})
		);

		const config = await readConfig(fixtureDir);
		expect(config.claudeDir).toBe(join(homedir(), '.claude'));
		expect(config.repoDirs).toEqual([join(homedir(), 'projects'), '/absolute/path']);
		expect(config.anthropicApiKey).toBe('sk-test');
		expect(config.aiModel).toBe('claude-opus-4-5-20251101');
		expect(config.costAlertThreshold).toBe(100);
		expect(config.refreshInterval).toBe(60000);
	});

	it('expands tilde in claudeDir', async () => {
		await writeFile(
			join(fixtureDir, 'claudeitor.config.json'),
			JSON.stringify({ claudeDir: '~/custom-claude-dir' })
		);

		const config = await readConfig(fixtureDir);
		expect(config.claudeDir).toBe(join(homedir(), 'custom-claude-dir'));
	});

	it('expands tilde in repoDirs entries', async () => {
		await writeFile(
			join(fixtureDir, 'claudeitor.config.json'),
			JSON.stringify({ repoDirs: ['~/code', '~/projects'] })
		);

		const config = await readConfig(fixtureDir);
		expect(config.repoDirs).toEqual([join(homedir(), 'code'), join(homedir(), 'projects')]);
	});

	it('fills missing fields with defaults', async () => {
		await writeFile(
			join(fixtureDir, 'claudeitor.config.json'),
			JSON.stringify({ costAlertThreshold: 200 })
		);

		const config = await readConfig(fixtureDir);
		expect(config.costAlertThreshold).toBe(200);
		expect(config.claudeDir).toBe(join(homedir(), '.claude'));
		expect(config.repoDirs).toEqual([]);
	});

	it('handles malformed JSON gracefully', async () => {
		await writeFile(join(fixtureDir, 'claudeitor.config.json'), '{bad json}');

		const config = await readConfig(fixtureDir);
		// Should return defaults
		expect(config.claudeDir).toBe(join(homedir(), '.claude'));
		expect(config.repoDirs).toEqual([]);
	});

	it('returns default themeOverride for invalid theme value', async () => {
		await writeFile(
			join(fixtureDir, 'claudeitor.config.json'),
			JSON.stringify({ themeOverride: 'neon' })
		);

		const config = await readConfig(fixtureDir);
		expect(config.themeOverride).toBe('system');
	});

	it('accepts valid themeOverride values', async () => {
		for (const theme of ['light', 'dark', 'system'] as const) {
			await writeFile(
				join(fixtureDir, 'claudeitor.config.json'),
				JSON.stringify({ themeOverride: theme })
			);

			const config = await readConfig(fixtureDir);
			expect(config.themeOverride).toBe(theme);
		}
	});
});

describe('writeConfig', () => {
	it('writes config file atomically', async () => {
		const writeDir = await mkdtemp(join(tmpdir(), 'claudeitor-write-config-'));
		const config = defaultConfig();
		config.anthropicApiKey = 'sk-test-write';
		config.costAlertThreshold = 75;

		await writeConfig(config, writeDir);

		const raw = await readFile(join(writeDir, 'claudeitor.config.json'), 'utf-8');
		const parsed = JSON.parse(raw);
		expect(parsed.anthropicApiKey).toBe('sk-test-write');
		expect(parsed.costAlertThreshold).toBe(75);
		await rm(writeDir, { recursive: true, force: true });
	});

	it('round-trips through readConfig', async () => {
		const writeDir = await mkdtemp(join(tmpdir(), 'claudeitor-roundtrip-'));
		const config = defaultConfig();
		config.repoDirs = ['/some/path'];
		config.aiModel = 'claude-opus-4-5-20251101';

		await writeConfig(config, writeDir);
		const readBack = await readConfig(writeDir);

		expect(readBack.repoDirs).toEqual(['/some/path']);
		expect(readBack.aiModel).toBe('claude-opus-4-5-20251101');
		expect(readBack.themeOverride).toBe('system');
		await rm(writeDir, { recursive: true, force: true });
	});

	it('overwrites existing config file', async () => {
		const writeDir = await mkdtemp(join(tmpdir(), 'claudeitor-overwrite-'));
		const config1 = defaultConfig();
		config1.costAlertThreshold = 50;
		await writeConfig(config1, writeDir);

		const config2 = defaultConfig();
		config2.costAlertThreshold = 200;
		await writeConfig(config2, writeDir);

		const readBack = await readConfig(writeDir);
		expect(readBack.costAlertThreshold).toBe(200);
		await rm(writeDir, { recursive: true, force: true });
	});
});

describe('expandTilde', () => {
	it('expands ~ to home directory', () => {
		expect(expandTilde('~')).toBe(homedir());
	});

	it('expands ~/ prefix to home directory', () => {
		expect(expandTilde('~/foo/bar')).toBe(join(homedir(), 'foo/bar'));
	});

	it('does not expand paths without tilde', () => {
		expect(expandTilde('/absolute/path')).toBe('/absolute/path');
		expect(expandTilde('relative/path')).toBe('relative/path');
	});

	it('does not expand tilde in the middle of a path', () => {
		expect(expandTilde('/some/~/path')).toBe('/some/~/path');
	});
});

describe('defaultConfig', () => {
	it('returns a fresh object each call (factory function)', () => {
		const a = defaultConfig();
		const b = defaultConfig();
		expect(a).toEqual(b);
		expect(a).not.toBe(b); // Different references
	});

	it('has expected default values', () => {
		const config = defaultConfig();
		expect(config.claudeDir).toBe(join(homedir(), '.claude'));
		expect(config.repoDirs).toEqual([]);
		expect(config.anthropicApiKey).toBe('');
		expect(config.aiModel).toBe('claude-sonnet-4-5-20250929');
		expect(config.costAlertThreshold).toBe(50);
		expect(config.refreshInterval).toBe(30_000);
		expect(config.themeOverride).toBe('system');
	});
});
