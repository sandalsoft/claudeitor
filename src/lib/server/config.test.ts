import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { readConfig } from './config.js';

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
});
