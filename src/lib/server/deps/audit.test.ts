import { describe, it, expect } from 'vitest';
import { parseAuditJson, parseOutdatedJson } from './audit.js';

// ─── parseAuditJson (pure parsing, fixture strings) ─────────

describe('parseAuditJson', () => {
	it('parses npm audit v2 metadata format', () => {
		const fixture = JSON.stringify({
			metadata: {
				vulnerabilities: {
					info: 0,
					low: 2,
					moderate: 3,
					high: 1,
					critical: 0,
					total: 6
				}
			}
		});

		const result = parseAuditJson(fixture);
		expect(result.total).toBe(6);
		expect(result.vulnerabilities).toHaveLength(3);
		expect(result.vulnerabilities).toEqual([
			{ severity: 'high', count: 1 },
			{ severity: 'moderate', count: 3 },
			{ severity: 'low', count: 2 }
		]);
	});

	it('parses npm audit v2 format with critical vulnerabilities', () => {
		const fixture = JSON.stringify({
			metadata: {
				vulnerabilities: {
					info: 0,
					low: 0,
					moderate: 0,
					high: 2,
					critical: 1,
					total: 3
				}
			}
		});

		const result = parseAuditJson(fixture);
		expect(result.total).toBe(3);
		expect(result.vulnerabilities).toEqual([
			{ severity: 'critical', count: 1 },
			{ severity: 'high', count: 2 }
		]);
	});

	it('handles zero vulnerabilities', () => {
		const fixture = JSON.stringify({
			metadata: {
				vulnerabilities: {
					info: 0,
					low: 0,
					moderate: 0,
					high: 0,
					critical: 0,
					total: 0
				}
			}
		});

		const result = parseAuditJson(fixture);
		expect(result.total).toBe(0);
		expect(result.vulnerabilities).toHaveLength(0);
	});

	it('parses npm audit v1 advisories format', () => {
		const fixture = JSON.stringify({
			advisories: {
				'1234': { severity: 'high' },
				'1235': { severity: 'moderate' },
				'1236': { severity: 'high' }
			}
		});

		const result = parseAuditJson(fixture);
		expect(result.total).toBe(3);
		expect(result.vulnerabilities).toEqual([
			{ severity: 'high', count: 2 },
			{ severity: 'moderate', count: 1 }
		]);
	});

	it('returns empty for empty input', () => {
		const result = parseAuditJson('');
		expect(result.total).toBe(0);
		expect(result.vulnerabilities).toHaveLength(0);
	});

	it('returns empty for invalid JSON', () => {
		const result = parseAuditJson('not json at all');
		expect(result.total).toBe(0);
		expect(result.vulnerabilities).toHaveLength(0);
	});

	it('returns empty for unknown JSON structure', () => {
		const result = parseAuditJson(JSON.stringify({ foo: 'bar' }));
		expect(result.total).toBe(0);
		expect(result.vulnerabilities).toHaveLength(0);
	});

	it('skips severity counts of zero', () => {
		const fixture = JSON.stringify({
			metadata: {
				vulnerabilities: {
					info: 0,
					low: 5,
					moderate: 0,
					high: 0,
					critical: 0,
					total: 5
				}
			}
		});

		const result = parseAuditJson(fixture);
		expect(result.vulnerabilities).toHaveLength(1);
		expect(result.vulnerabilities[0]).toEqual({ severity: 'low', count: 5 });
	});
});

// ─── parseOutdatedJson (pure parsing, fixture strings) ──────

describe('parseOutdatedJson', () => {
	it('parses npm outdated JSON output', () => {
		const fixture = JSON.stringify({
			'lodash': {
				current: '4.17.20',
				wanted: '4.17.21',
				latest: '4.17.21',
				type: 'dependencies'
			},
			'express': {
				current: '4.17.1',
				wanted: '4.18.2',
				latest: '5.0.0',
				type: 'dependencies'
			}
		});

		const result = parseOutdatedJson(fixture);
		expect(result).toHaveLength(2);
		// Sorted by name
		expect(result[0].name).toBe('express');
		expect(result[0].current).toBe('4.17.1');
		expect(result[0].wanted).toBe('4.18.2');
		expect(result[0].latest).toBe('5.0.0');
		expect(result[0].type).toBe('dependencies');
		expect(result[1].name).toBe('lodash');
	});

	it('handles devDependencies', () => {
		const fixture = JSON.stringify({
			'vitest': {
				current: '1.0.0',
				wanted: '1.5.0',
				latest: '2.0.0',
				type: 'devDependencies'
			}
		});

		const result = parseOutdatedJson(fixture);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe('devDependencies');
	});

	it('returns empty for empty input', () => {
		expect(parseOutdatedJson('')).toEqual([]);
	});

	it('returns empty for invalid JSON', () => {
		expect(parseOutdatedJson('not json')).toEqual([]);
	});

	it('returns empty for empty object', () => {
		expect(parseOutdatedJson('{}')).toEqual([]);
	});

	it('handles missing fields gracefully', () => {
		const fixture = JSON.stringify({
			'some-pkg': {}
		});

		const result = parseOutdatedJson(fixture);
		expect(result).toHaveLength(1);
		expect(result[0].current).toBe('N/A');
		expect(result[0].wanted).toBe('N/A');
		expect(result[0].latest).toBe('N/A');
		expect(result[0].type).toBe('dependencies');
	});

	it('returns empty for non-object JSON', () => {
		expect(parseOutdatedJson('"string"')).toEqual([]);
		expect(parseOutdatedJson('null')).toEqual([]);
		expect(parseOutdatedJson('[1,2,3]')).toEqual([]);
	});
});
