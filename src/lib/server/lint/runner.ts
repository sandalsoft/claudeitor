import { stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { LintResult, LintIssue, LintSeverity } from '$lib/data/types';
import { safeExecFile } from '$lib/server/system/exec.js';
import { warn } from '$lib/server/telemetry/logger';

const ESLINT_TIMEOUT_MS = 15_000;
const TSC_TIMEOUT_MS = 15_000;

// ─── ESLint JSON parsing ───────────────────────────────────

/**
 * ESLint --format json returns an array of file results:
 * [{ filePath, messages: [{ ruleId, severity, message, line, column }], errorCount, warningCount }]
 */
export function parseEslintJson(stdout: string, repoPath: string): LintIssue[] {
	if (!stdout.trim()) return [];

	try {
		const data = JSON.parse(stdout);

		if (!Array.isArray(data)) return [];

		const issues: LintIssue[] = [];

		for (const file of data) {
			if (!file.messages || !Array.isArray(file.messages)) continue;

			// Make file path relative to repo root
			const absPath = String(file.filePath ?? '');
			const filePath = absPath.startsWith(repoPath)
				? absPath.slice(repoPath.length + 1)
				: absPath;

			for (const msg of file.messages) {
				// ESLint severity: 1 = warning, 2 = error
				const severity: LintSeverity = msg.severity === 2 ? 'error' : 'warning';

				issues.push({
					filePath,
					line: typeof msg.line === 'number' ? msg.line : 0,
					column: typeof msg.column === 'number' ? msg.column : 0,
					severity,
					message: String(msg.message ?? ''),
					ruleId: String(msg.ruleId ?? 'unknown')
				});
			}
		}

		return issues;
	} catch {
		return [];
	}
}

// ─── TypeScript compiler output parsing ────────────────────

/**
 * Parse tsc --noEmit --pretty false output.
 * Format: "path(line,col): error TS1234: message"
 * The output may come from stdout OR stderr (varies by tsc version), so callers
 * should concatenate stdout + '\n' + stderr before passing here.
 */
export function parseTscOutput(combined: string, repoPath: string): LintIssue[] {
	if (!combined.trim()) return [];

	const issues: LintIssue[] = [];
	const lines = combined.split('\n');

	// Match lines like: src/foo.ts(10,5): error TS2345: Argument of type...
	const pattern = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const match = trimmed.match(pattern);
		if (!match) continue;

		const [, rawPath, lineStr, colStr, sev, code, message] = match;

		// Make path relative to repo root
		const filePath = rawPath.startsWith(repoPath)
			? rawPath.slice(repoPath.length + 1)
			: rawPath;

		const severity: LintSeverity = sev === 'error' ? 'error' : 'warning';

		issues.push({
			filePath,
			line: parseInt(lineStr, 10),
			column: parseInt(colStr, 10),
			severity,
			message,
			ruleId: code
		});
	}

	return issues;
}

// ─── Binary existence check ────────────────────────────────

async function binaryExists(repoPath: string, relPath: string): Promise<boolean> {
	try {
		await stat(join(repoPath, relPath));
		return true;
	} catch {
		return false;
	}
}

// ─── Main lint function ────────────────────────────────────

/**
 * Run lint checks for a single repository.
 * Uses local executables only (never npx).
 */
export async function lintRepo(repoPath: string): Promise<LintResult> {
	const repo = basename(repoPath);

	const eslintBin = join('node_modules', '.bin', 'eslint');
	const tscBin = join('node_modules', '.bin', 'tsc');

	const [eslintExists, tscExists] = await Promise.all([
		binaryExists(repoPath, eslintBin),
		binaryExists(repoPath, tscBin)
	]);

	let eslintIssues: LintIssue[] = [];
	let tscIssues: LintIssue[] = [];

	// Run eslint if available
	if (eslintExists) {
		const eslintExec = await safeExecFile(
			join(repoPath, eslintBin),
			['--format', 'json', '.'],
			{ cwd: repoPath, timeout: ESLINT_TIMEOUT_MS }
		);

		if (eslintExec.timedOut) {
			warn('lint', `eslint timed out for ${repo}`, { 'exec.timeout_ms': ESLINT_TIMEOUT_MS });
		} else {
			// eslint exits non-zero when issues found; parse stdout regardless
			eslintIssues = parseEslintJson(eslintExec.stdout, repoPath);
		}
	}

	// Run tsc if available
	if (tscExists) {
		const tscExec = await safeExecFile(
			join(repoPath, tscBin),
			['--noEmit', '--pretty', 'false'],
			{ cwd: repoPath, timeout: TSC_TIMEOUT_MS }
		);

		if (tscExec.timedOut) {
			warn('lint', `tsc timed out for ${repo}`, { 'exec.timeout_ms': TSC_TIMEOUT_MS });
		} else {
			// Concatenate stdout + stderr per spec requirement
			const combined = tscExec.stdout + '\n' + tscExec.stderr;
			tscIssues = parseTscOutput(combined, repoPath);
		}
	}

	const allIssues = [...eslintIssues, ...tscIssues];
	const errorCount = allIssues.filter((i) => i.severity === 'error').length;
	const warningCount = allIssues.filter((i) => i.severity === 'warning').length;

	return {
		repo,
		repoPath,
		eslintIssues,
		tscIssues,
		errorCount,
		warningCount,
		eslintAvailable: eslintExists,
		tscAvailable: tscExists
	};
}
