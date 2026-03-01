import { describe, it, expect } from 'vitest';
import { readStatsCache } from './stats.js';
import { readCostCache, readPricing } from './costs.js';
import { readSessionHistory } from './sessions.js';
import { readSkills } from './skills.js';
import { readAgents } from './agents.js';
import { readSettings } from './settings.js';

// These tests run against the real ~/.claude/ directory.
// They verify that our readers handle real data without throwing.

describe('readStatsCache', () => {
	it('returns a valid StatsCache object', async () => {
		const stats = await readStatsCache();
		expect(stats).toHaveProperty('version');
		expect(stats).toHaveProperty('dailyActivity');
		expect(stats).toHaveProperty('modelUsage');
		expect(stats).toHaveProperty('totalSessions');
		expect(stats).toHaveProperty('hourCounts');
		expect(Array.isArray(stats.dailyActivity)).toBe(true);
	});

	it('dailyActivity entries have expected shape', async () => {
		const stats = await readStatsCache();
		if (stats.dailyActivity.length > 0) {
			const entry = stats.dailyActivity[0];
			expect(entry).toHaveProperty('date');
			expect(entry).toHaveProperty('messageCount');
			expect(entry).toHaveProperty('sessionCount');
			expect(entry).toHaveProperty('toolCallCount');
		}
	});
});

describe('readCostCache', () => {
	it('returns a valid CostCache object', async () => {
		const costs = await readCostCache();
		expect(costs).toHaveProperty('version');
		expect(costs).toHaveProperty('days');
		expect(typeof costs.days).toBe('object');
	});

	it('day entries contain model token usage', async () => {
		const costs = await readCostCache();
		const days = Object.keys(costs.days);
		if (days.length > 0) {
			const dayData = costs.days[days[0]];
			const models = Object.keys(dayData);
			if (models.length > 0) {
				const usage = dayData[models[0]];
				expect(usage).toHaveProperty('input');
				expect(usage).toHaveProperty('output');
			}
		}
	});
});

describe('readPricing', () => {
	it('returns a valid PricingData object', async () => {
		const pricing = await readPricing();
		expect(pricing).toHaveProperty('updated');
		expect(pricing).toHaveProperty('models');
		expect(typeof pricing.models).toBe('object');
	});

	it('model pricing has expected fields', async () => {
		const pricing = await readPricing();
		const keys = Object.keys(pricing.models);
		if (keys.length > 0) {
			const model = pricing.models[keys[0]];
			expect(model).toHaveProperty('input');
			expect(model).toHaveProperty('output');
			expect(model).toHaveProperty('cacheRead');
			expect(model).toHaveProperty('cacheWrite');
		}
	});
});

describe('readSessionHistory', () => {
	it('returns an array of session entries', async () => {
		const sessions = await readSessionHistory();
		expect(Array.isArray(sessions)).toBe(true);
	});

	it('session entries have expected shape', async () => {
		const sessions = await readSessionHistory();
		if (sessions.length > 0) {
			const entry = sessions[0];
			expect(entry).toHaveProperty('display');
			expect(entry).toHaveProperty('timestamp');
			expect(entry).toHaveProperty('project');
		}
	});
});

describe('readSkills', () => {
	it('returns an array of skill info objects', async () => {
		const skills = await readSkills();
		expect(Array.isArray(skills)).toBe(true);
	});

	it('skill entries have expected shape', async () => {
		const skills = await readSkills();
		if (skills.length > 0) {
			const entry = skills[0];
			expect(entry).toHaveProperty('name');
			expect(entry).toHaveProperty('path');
			expect(entry).toHaveProperty('isSymlink');
		}
	});
});

describe('readAgents', () => {
	it('returns an array of agent info objects', async () => {
		const agents = await readAgents();
		expect(Array.isArray(agents)).toBe(true);
	});

	it('agent entries have expected shape', async () => {
		const agents = await readAgents();
		if (agents.length > 0) {
			const entry = agents[0];
			expect(entry).toHaveProperty('name');
			expect(entry).toHaveProperty('path');
			expect(entry).toHaveProperty('content');
			expect(typeof entry.content).toBe('string');
		}
	});
});

describe('readSettings', () => {
	it('returns a valid SettingsData object', async () => {
		const settings = await readSettings();
		expect(settings).toHaveProperty('model');
		expect(settings).toHaveProperty('hooks');
		expect(settings).toHaveProperty('enabledPlugins');
	});
});
