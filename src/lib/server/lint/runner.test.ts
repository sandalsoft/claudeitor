import { describe, it, expect } from 'vitest';
import { parseEslintJson, parseTscOutput } from './runner.js';

// ─── parseEslintJson (pure parsing, fixture strings) ────────

const REPO_PATH = '/Users/eric/Development/my-project';

describe('parseEslintJson', () => {
	it('parses eslint JSON output with errors and warnings', () => {
		const fixture = JSON.stringify([
			{
				filePath: `${REPO_PATH}/src/index.ts`,
				messages: [
					{
						ruleId: 'no-unused-vars',
						severity: 2,
						message: "'foo' is assigned a value but never used.",
						line: 10,
						column: 7
					},
					{
						ruleId: 'prefer-const',
						severity: 1,
						message: "'bar' is never reassigned. Use 'const' instead.",
						line: 15,
						column: 3
					}
				],
				errorCount: 1,
				warningCount: 1
			}
		]);

		const issues = parseEslintJson(fixture, REPO_PATH);
		expect(issues).toHaveLength(2);

		expect(issues[0]).toEqual({
			filePath: 'src/index.ts',
			line: 10,
			column: 7,
			severity: 'error',
			message: "'foo' is assigned a value but never used.",
			ruleId: 'no-unused-vars'
		});

		expect(issues[1]).toEqual({
			filePath: 'src/index.ts',
			line: 15,
			column: 3,
			severity: 'warning',
			message: "'bar' is never reassigned. Use 'const' instead.",
			ruleId: 'prefer-const'
		});
	});

	it('handles multiple files', () => {
		const fixture = JSON.stringify([
			{
				filePath: `${REPO_PATH}/src/a.ts`,
				messages: [
					{ ruleId: 'no-console', severity: 1, message: 'Unexpected console statement.', line: 5, column: 1 }
				]
			},
			{
				filePath: `${REPO_PATH}/src/b.ts`,
				messages: [
					{ ruleId: '@typescript-eslint/no-explicit-any', severity: 2, message: 'Unexpected any.', line: 3, column: 10 }
				]
			}
		]);

		const issues = parseEslintJson(fixture, REPO_PATH);
		expect(issues).toHaveLength(2);
		expect(issues[0].filePath).toBe('src/a.ts');
		expect(issues[1].filePath).toBe('src/b.ts');
	});

	it('makes file paths relative to repo root', () => {
		const fixture = JSON.stringify([
			{
				filePath: `${REPO_PATH}/deep/nested/file.ts`,
				messages: [
					{ ruleId: 'rule', severity: 2, message: 'msg', line: 1, column: 1 }
				]
			}
		]);

		const issues = parseEslintJson(fixture, REPO_PATH);
		expect(issues[0].filePath).toBe('deep/nested/file.ts');
	});

	it('returns empty for empty input', () => {
		expect(parseEslintJson('', REPO_PATH)).toEqual([]);
	});

	it('returns empty for invalid JSON', () => {
		expect(parseEslintJson('not json', REPO_PATH)).toEqual([]);
	});

	it('returns empty for non-array JSON', () => {
		expect(parseEslintJson('{}', REPO_PATH)).toEqual([]);
	});

	it('handles files with no messages', () => {
		const fixture = JSON.stringify([
			{
				filePath: `${REPO_PATH}/src/clean.ts`,
				messages: [],
				errorCount: 0,
				warningCount: 0
			}
		]);

		const issues = parseEslintJson(fixture, REPO_PATH);
		expect(issues).toHaveLength(0);
	});

	it('handles missing ruleId gracefully', () => {
		const fixture = JSON.stringify([
			{
				filePath: `${REPO_PATH}/src/test.ts`,
				messages: [
					{ severity: 2, message: 'Parsing error', line: 1, column: 1 }
				]
			}
		]);

		const issues = parseEslintJson(fixture, REPO_PATH);
		expect(issues).toHaveLength(1);
		expect(issues[0].ruleId).toBe('unknown');
	});
});

// ─── parseTscOutput (pure parsing, fixture strings) ─────────

describe('parseTscOutput', () => {
	it('parses tsc error output', () => {
		const fixture = [
			`src/index.ts(10,5): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`,
			`src/utils.ts(25,18): error TS2322: Type 'undefined' is not assignable to type 'string'.`
		].join('\n');

		const issues = parseTscOutput(fixture, REPO_PATH);
		expect(issues).toHaveLength(2);

		expect(issues[0]).toEqual({
			filePath: 'src/index.ts',
			line: 10,
			column: 5,
			severity: 'error',
			message: "Argument of type 'string' is not assignable to parameter of type 'number'.",
			ruleId: 'TS2345'
		});

		expect(issues[1]).toEqual({
			filePath: 'src/utils.ts',
			line: 25,
			column: 18,
			severity: 'error',
			message: "Type 'undefined' is not assignable to type 'string'.",
			ruleId: 'TS2322'
		});
	});

	it('handles absolute paths by making them relative', () => {
		const fixture = `${REPO_PATH}/src/deep/file.ts(5,10): error TS1234: Some error message.`;

		const issues = parseTscOutput(fixture, REPO_PATH);
		expect(issues).toHaveLength(1);
		expect(issues[0].filePath).toBe('src/deep/file.ts');
	});

	it('handles relative paths as-is', () => {
		const fixture = `src/foo.ts(1,1): error TS9999: Test error.`;

		const issues = parseTscOutput(fixture, REPO_PATH);
		expect(issues).toHaveLength(1);
		expect(issues[0].filePath).toBe('src/foo.ts');
	});

	it('returns empty for empty input', () => {
		expect(parseTscOutput('', REPO_PATH)).toEqual([]);
	});

	it('skips non-error lines', () => {
		const fixture = [
			'',
			'Found 2 errors.',
			'src/index.ts(10,5): error TS2345: Real error.',
			''
		].join('\n');

		const issues = parseTscOutput(fixture, REPO_PATH);
		expect(issues).toHaveLength(1);
		expect(issues[0].ruleId).toBe('TS2345');
	});

	it('handles mixed stdout and stderr content', () => {
		// Simulating concatenated stdout + '\n' + stderr
		const stdout = 'src/a.ts(1,1): error TS1001: Error one.';
		const stderr = 'src/b.ts(2,2): error TS1002: Error two.';
		const combined = stdout + '\n' + stderr;

		const issues = parseTscOutput(combined, REPO_PATH);
		expect(issues).toHaveLength(2);
	});

	it('handles tsc warning output (rare but possible)', () => {
		// tsc doesn't typically output "warning" but the parser handles it
		const fixture = `src/foo.ts(5,3): warning TS6133: 'x' is declared but its value is never read.`;

		const issues = parseTscOutput(fixture, REPO_PATH);
		expect(issues).toHaveLength(1);
		expect(issues[0].severity).toBe('warning');
	});

	it('handles file paths with spaces', () => {
		const fixture = `src/my file.ts(1,1): error TS1234: Some error.`;

		const issues = parseTscOutput(fixture, REPO_PATH);
		expect(issues).toHaveLength(1);
		expect(issues[0].filePath).toBe('src/my file.ts');
	});

	it('handles multiple errors in same file', () => {
		const fixture = [
			'src/index.ts(1,1): error TS1001: Error one.',
			'src/index.ts(10,5): error TS1002: Error two.',
			'src/index.ts(20,3): error TS1003: Error three.'
		].join('\n');

		const issues = parseTscOutput(fixture, REPO_PATH);
		expect(issues).toHaveLength(3);
		expect(issues.every((i) => i.filePath === 'src/index.ts')).toBe(true);
	});
});
