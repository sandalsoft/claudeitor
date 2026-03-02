import { stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { DepAuditResult, DepAuditStatus, AuditVulnerability, OutdatedPackage } from '$lib/data/types';
import { safeExecFile, type ExecResult } from '$lib/server/system/exec.js';
import { warn } from '$lib/server/telemetry/logger';

const AUDIT_TIMEOUT_MS = 10_000;
const OUTDATED_TIMEOUT_MS = 10_000;

// ─── Cache ──────────────────────────────────────────────────

interface CacheEntry {
	result: DepAuditResult;
	lockfileMtime: number;
}

const auditCache = new Map<string, CacheEntry>();

/**
 * Clear the audit cache (useful for testing).
 */
export function clearAuditCache(): void {
	auditCache.clear();
}

// ─── Status derivation ─────────────────────────────────────

/** Offline-detection heuristics for stderr content. */
const OFFLINE_PATTERNS = ['ENOTFOUND', 'ENETUNREACH', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'];

function isOfflineError(stderr: string): boolean {
	return OFFLINE_PATTERNS.some((p) => stderr.includes(p));
}

/**
 * Derive audit status from the exec result.
 * Priority: timedOut -> offline (stderr heuristics) -> parse JSON -> unavailable.
 */
function deriveStatus(result: ExecResult): { status: DepAuditStatus; message: string } {
	if (result.timedOut) {
		return { status: 'timeout', message: 'Command timed out' };
	}
	if (isOfflineError(result.stderr)) {
		return { status: 'offline', message: 'npm registry unreachable' };
	}
	return { status: 'ok', message: '' };
}

// ─── npm audit JSON parsing ────────────────────────────────

/** Severity levels in priority order. */
const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low', 'info'] as const;

/**
 * Parse npm audit --json output into vulnerability summary.
 * The npm audit JSON format has a `metadata.vulnerabilities` object with severity counts.
 */
export function parseAuditJson(stdout: string): {
	total: number;
	vulnerabilities: AuditVulnerability[];
} {
	if (!stdout.trim()) return { total: 0, vulnerabilities: [] };

	try {
		const data = JSON.parse(stdout);

		// npm audit v2+ format: metadata.vulnerabilities = { info: N, low: N, moderate: N, high: N, critical: N, total: N }
		const meta = data?.metadata?.vulnerabilities;
		if (meta && typeof meta === 'object') {
			const vulnerabilities: AuditVulnerability[] = [];
			let total = 0;

			for (const severity of SEVERITY_ORDER) {
				const count = typeof meta[severity] === 'number' ? meta[severity] : 0;
				if (count > 0) {
					vulnerabilities.push({ severity, count });
					total += count;
				}
			}

			return { total, vulnerabilities };
		}

		// Fallback: npm audit v1 format or unknown
		// Try to count advisories
		const advisories = data?.advisories;
		if (advisories && typeof advisories === 'object') {
			const severityCounts = new Map<string, number>();
			for (const advisory of Object.values(advisories) as Array<{ severity?: string }>) {
				const sev = advisory?.severity ?? 'info';
				severityCounts.set(sev, (severityCounts.get(sev) ?? 0) + 1);
			}
			const vulnerabilities: AuditVulnerability[] = [];
			let total = 0;
			for (const severity of SEVERITY_ORDER) {
				const count = severityCounts.get(severity) ?? 0;
				if (count > 0) {
					vulnerabilities.push({ severity, count });
					total += count;
				}
			}
			return { total, vulnerabilities };
		}

		return { total: 0, vulnerabilities: [] };
	} catch {
		return { total: 0, vulnerabilities: [] };
	}
}

// ─── npm outdated JSON parsing ─────────────────────────────

/**
 * Parse npm outdated --json output into a list of outdated packages.
 * npm outdated --json returns { "package-name": { current, wanted, latest, type, ... }, ... }
 */
export function parseOutdatedJson(stdout: string): OutdatedPackage[] {
	if (!stdout.trim()) return [];

	try {
		const data = JSON.parse(stdout);

		if (typeof data !== 'object' || data === null || Array.isArray(data)) return [];

		const packages: OutdatedPackage[] = [];

		for (const [name, info] of Object.entries(data)) {
			const pkg = info as Record<string, unknown>;
			packages.push({
				name,
				current: String(pkg.current ?? 'N/A'),
				wanted: String(pkg.wanted ?? 'N/A'),
				latest: String(pkg.latest ?? 'N/A'),
				type: String(pkg.type ?? 'dependencies')
			});
		}

		// Sort by name for consistent display
		packages.sort((a, b) => a.name.localeCompare(b.name));
		return packages;
	} catch {
		return [];
	}
}

// ─── Main audit function ───────────────────────────────────

/**
 * Get the lockfile mtime for cache invalidation.
 * Returns 0 if no lockfile exists.
 */
async function getLockfileMtime(repoPath: string): Promise<number> {
	try {
		const s = await stat(join(repoPath, 'package-lock.json'));
		return s.mtimeMs;
	} catch {
		try {
			const s = await stat(join(repoPath, 'npm-shrinkwrap.json'));
			return s.mtimeMs;
		} catch {
			return 0;
		}
	}
}

/**
 * Check if a repo has a package.json (npm project).
 */
async function hasPackageJson(repoPath: string): Promise<boolean> {
	try {
		await stat(join(repoPath, 'package.json'));
		return true;
	} catch {
		return false;
	}
}

/**
 * Run dependency audit for a single repository.
 * Uses caching keyed by repo path + lockfile mtime.
 */
export async function auditRepo(repoPath: string): Promise<DepAuditResult> {
	const repo = basename(repoPath);

	// Check if this is an npm project
	if (!(await hasPackageJson(repoPath))) {
		return {
			repo,
			repoPath,
			status: 'unavailable',
			statusMessage: 'No package.json found',
			totalVulnerabilities: 0,
			vulnerabilities: [],
			outdated: []
		};
	}

	// Check cache by lockfile mtime
	const lockMtime = await getLockfileMtime(repoPath);
	const cached = auditCache.get(repoPath);
	if (cached && cached.lockfileMtime === lockMtime && lockMtime > 0) {
		return cached.result;
	}

	// Run npm audit
	const auditExec = await safeExecFile('npm', ['audit', '--json'], {
		cwd: repoPath,
		timeout: AUDIT_TIMEOUT_MS
	});

	const auditStatus = deriveStatus(auditExec);

	if (auditStatus.status !== 'ok') {
		const result: DepAuditResult = {
			repo,
			repoPath,
			status: auditStatus.status,
			statusMessage: auditStatus.message,
			totalVulnerabilities: 0,
			vulnerabilities: [],
			outdated: []
		};
		return result;
	}

	// Parse audit output -- try regardless of exit code since npm audit exits non-zero on findings
	let auditData: { total: number; vulnerabilities: AuditVulnerability[] };
	try {
		auditData = parseAuditJson(auditExec.stdout);
	} catch {
		const result: DepAuditResult = {
			repo,
			repoPath,
			status: 'unavailable',
			statusMessage: 'Failed to parse npm audit output',
			totalVulnerabilities: 0,
			vulnerabilities: [],
			outdated: []
		};
		return result;
	}

	// Run npm outdated -- also exits non-zero when outdated packages exist
	const outdatedExec = await safeExecFile('npm', ['outdated', '--json'], {
		cwd: repoPath,
		timeout: OUTDATED_TIMEOUT_MS
	});

	let outdated: OutdatedPackage[] = [];
	// Don't fail the whole audit if outdated check fails
	const outdatedStatus = deriveStatus(outdatedExec);
	if (outdatedStatus.status === 'ok' || outdatedExec.stdout.trim()) {
		outdated = parseOutdatedJson(outdatedExec.stdout);
	} else {
		warn('deps', `npm outdated failed for ${repo}`, {
			'exec.status': outdatedStatus.status,
			'exec.message': outdatedStatus.message
		});
	}

	// Derive overall status
	let status: DepAuditStatus = 'ok';
	let statusMessage = 'No issues found';

	if (auditData.total > 0) {
		const hasCritical = auditData.vulnerabilities.some((v) => v.severity === 'critical');
		const hasHigh = auditData.vulnerabilities.some((v) => v.severity === 'high');
		status = hasCritical || hasHigh ? 'error' : 'warn';
		statusMessage = `${auditData.total} vulnerabilit${auditData.total === 1 ? 'y' : 'ies'} found`;
	} else if (outdated.length > 0) {
		status = 'warn';
		statusMessage = `${outdated.length} outdated package${outdated.length === 1 ? '' : 's'}`;
	}

	const result: DepAuditResult = {
		repo,
		repoPath,
		status,
		statusMessage,
		totalVulnerabilities: auditData.total,
		vulnerabilities: auditData.vulnerabilities,
		outdated
	};

	// Cache result
	auditCache.set(repoPath, { result, lockfileMtime: lockMtime });

	return result;
}
