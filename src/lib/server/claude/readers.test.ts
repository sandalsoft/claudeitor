import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readStatsCache } from './stats.js';
import { readCostCache, readPricing } from './costs.js';
import { readSessionHistory } from './sessions.js';
import { readSkills } from './skills.js';
import { readAgents } from './agents.js';
import { readSettings } from './settings.js';

let fixtureDir: string;

beforeAll(async () => {
	fixtureDir = await mkdtemp(join(tmpdir(), 'claudeitor-test-'));

	// stats-cache.json
	await writeFile(
		join(fixtureDir, 'stats-cache.json'),
		JSON.stringify({
			version: 2,
			lastComputedDate: '2026-02-28',
			dailyActivity: [{ date: '2026-02-28', messageCount: 100, sessionCount: 5, toolCallCount: 20 }],
			dailyModelTokens: [{ date: '2026-02-28', tokensByModel: { 'claude-opus-4-5-20251101': 50000 } }],
			modelUsage: {
				'claude-opus-4-5-20251101': {
					inputTokens: 1000,
					outputTokens: 2000,
					cacheReadInputTokens: 5000,
					cacheCreationInputTokens: 500,
					webSearchRequests: 0,
					costUSD: 0,
					contextWindow: 0,
					maxOutputTokens: 0
				}
			},
			totalSessions: 42,
			totalMessages: 1000,
			longestSession: 120,
			firstSessionDate: '2026-01-01',
			hourCounts: { '10': 15, '14': 20 },
			totalSpeculationTimeSavedMs: 5000
		})
	);

	// readout-cost-cache.json
	await writeFile(
		join(fixtureDir, 'readout-cost-cache.json'),
		JSON.stringify({
			version: 1,
			lastFullScan: '2026-02-28',
			days: {
				'2026-02-28': {
					'claude-opus-4-5-20251101': { cacheRead: 1000, cacheWrite: 200, input: 50, output: 100 }
				}
			}
		})
	);

	// readout-pricing.json
	await writeFile(
		join(fixtureDir, 'readout-pricing.json'),
		JSON.stringify({
			updated: '2026-02-23',
			source: 'test',
			models: {
				'opus-4-5': { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 }
			}
		})
	);

	// history.jsonl
	await writeFile(
		join(fixtureDir, 'history.jsonl'),
		[
			JSON.stringify({ display: 'test command 1', pastedContents: {}, timestamp: 1700000000000, project: '/tmp/test' }),
			JSON.stringify({ display: 'test command 2', pastedContents: {}, timestamp: 1700000001000, project: '/tmp/test' }),
			'', // empty line (should be skipped)
			'not valid json', // malformed line (should be skipped)
		].join('\n')
	);

	// settings.json
	await writeFile(
		join(fixtureDir, 'settings.json'),
		JSON.stringify({
			env: { TEST: '1' },
			model: 'claude-opus-4-5',
			hooks: { PreToolUse: [] },
			enabledPlugins: { 'test-plugin': true }
		})
	);

	// skills/ directory
	const skillsDir = join(fixtureDir, 'skills');
	await mkdir(skillsDir);
	await mkdir(join(skillsDir, 'my-skill'));
	await mkdir(join(skillsDir, 'another-skill'));
	// Create a symlink skill
	await symlink(join(skillsDir, 'my-skill'), join(skillsDir, 'linked-skill'));

	// agents/ directory
	const agentsDir = join(fixtureDir, 'agents');
	await mkdir(agentsDir);
	await writeFile(join(agentsDir, 'code-reviewer.md'), '# Code Reviewer\nReviews code.');
	await writeFile(join(agentsDir, 'test-agent.md'), '# Test Agent\nRuns tests.');
});

afterAll(async () => {
	await rm(fixtureDir, { recursive: true, force: true });
});

describe('readStatsCache', () => {
	it('returns a valid StatsCache object from fixture', async () => {
		const stats = await readStatsCache(fixtureDir);
		expect(stats.version).toBe(2);
		expect(stats.totalSessions).toBe(42);
		expect(stats.dailyActivity).toHaveLength(1);
		expect(stats.dailyActivity[0].date).toBe('2026-02-28');
		expect(stats.dailyActivity[0].messageCount).toBe(100);
	});

	it('returns empty defaults for missing directory', async () => {
		const stats = await readStatsCache('/nonexistent/path');
		expect(stats.version).toBe(0);
		expect(stats.dailyActivity).toEqual([]);
		expect(stats.totalSessions).toBe(0);
	});
});

describe('readCostCache', () => {
	it('returns valid CostCache from fixture', async () => {
		const costs = await readCostCache(fixtureDir);
		expect(costs.version).toBe(1);
		expect(Object.keys(costs.days)).toContain('2026-02-28');
		const dayData = costs.days['2026-02-28'];
		expect(dayData['claude-opus-4-5-20251101'].input).toBe(50);
	});

	it('returns empty defaults for missing directory', async () => {
		const costs = await readCostCache('/nonexistent/path');
		expect(costs.days).toEqual({});
	});
});

describe('readPricing', () => {
	it('returns valid PricingData from fixture', async () => {
		const pricing = await readPricing(fixtureDir);
		expect(pricing.updated).toBe('2026-02-23');
		expect(pricing.models['opus-4-5'].input).toBe(5.0);
	});

	it('returns empty defaults for missing directory', async () => {
		const pricing = await readPricing('/nonexistent/path');
		expect(pricing.models).toEqual({});
	});
});

describe('readSessionHistory', () => {
	it('parses JSONL from fixture, skipping malformed lines', async () => {
		const sessions = await readSessionHistory(fixtureDir);
		expect(sessions).toHaveLength(2);
		expect(sessions[0].display).toBe('test command 1');
		expect(sessions[1].display).toBe('test command 2');
	});

	it('returns empty array for missing file', async () => {
		const sessions = await readSessionHistory('/nonexistent/path');
		expect(sessions).toEqual([]);
	});
});

describe('readSkills', () => {
	it('lists skill directories from fixture', async () => {
		const skills = await readSkills(fixtureDir);
		expect(skills.length).toBeGreaterThanOrEqual(2);
		const names = skills.map((s) => s.name);
		expect(names).toContain('my-skill');
		expect(names).toContain('another-skill');
		expect(names).toContain('linked-skill');
	});

	it('detects symlinks', async () => {
		const skills = await readSkills(fixtureDir);
		const linked = skills.find((s) => s.name === 'linked-skill');
		expect(linked?.isSymlink).toBe(true);
	});

	it('returns empty for missing directory', async () => {
		const skills = await readSkills('/nonexistent/path');
		expect(skills).toEqual([]);
	});
});

describe('readAgents', () => {
	it('reads agent files from fixture', async () => {
		const agents = await readAgents(fixtureDir);
		expect(agents).toHaveLength(2);
		const names = agents.map((a) => a.name);
		expect(names).toContain('code-reviewer');
		expect(names).toContain('test-agent');
	});

	it('reads agent content', async () => {
		const agents = await readAgents(fixtureDir);
		const reviewer = agents.find((a) => a.name === 'code-reviewer');
		expect(reviewer?.content).toContain('# Code Reviewer');
	});

	it('returns empty for missing directory', async () => {
		const agents = await readAgents('/nonexistent/path');
		expect(agents).toEqual([]);
	});
});

describe('readSettings', () => {
	it('returns valid SettingsData from fixture', async () => {
		const settings = await readSettings(fixtureDir);
		expect(settings.model).toBe('claude-opus-4-5');
		expect(settings.enabledPlugins['test-plugin']).toBe(true);
	});

	it('returns empty defaults for missing file', async () => {
		const settings = await readSettings('/nonexistent/path');
		expect(settings.model).toBe('');
		expect(settings.enabledPlugins).toEqual({});
	});
});
