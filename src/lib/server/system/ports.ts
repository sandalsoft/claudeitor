import { execFile } from 'node:child_process';
import type { PortInfo } from '$lib/data/types';
import { warn } from '$lib/server/telemetry/logger';

/** Result shape for safeExecFile -- always returns, never throws on non-zero exit. */
export interface ExecResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	timedOut: boolean;
}

const LSOF_TIMEOUT_MS = 5000;

/**
 * Safe wrapper around execFile that always returns a uniform result.
 * Catches errors from non-zero exit codes and extracts stdout/stderr from the error object.
 */
export function safeExecFile(
	cmd: string,
	args: string[],
	opts: { timeout?: number; cwd?: string } = {}
): Promise<ExecResult> {
	return new Promise((resolve) => {
		execFile(cmd, args, { timeout: opts.timeout ?? 10_000, cwd: opts.cwd }, (err, stdout, stderr) => {
			if (err) {
				const errObj = err as NodeJS.ErrnoException & { code?: string | number; killed?: boolean };
				const timedOut = errObj.killed === true || String(errObj.code) === 'ETIMEDOUT';
				// execFile includes stdout/stderr on error objects
				const errStdout = (err as unknown as { stdout?: string }).stdout ?? stdout ?? '';
				const errStderr = (err as unknown as { stderr?: string }).stderr ?? stderr ?? '';
				const exitCode =
					typeof errObj.code === 'number' ? errObj.code : (err as unknown as { status?: number }).status ?? 1;
				resolve({
					stdout: errStdout,
					stderr: errStderr,
					exitCode,
					timedOut
				});
				return;
			}
			resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 0, timedOut: false });
		});
	});
}

/**
 * Execute lsof to list listening TCP connections.
 * Uses execFile with array args per epic safety requirement.
 */
export async function execLsof(): Promise<ExecResult> {
	return safeExecFile('lsof', ['-i', '-P', '-n'], { timeout: LSOF_TIMEOUT_MS });
}

/**
 * Parse lsof output to extract listening port info.
 * Only includes entries with `(LISTEN)` in the NAME field.
 * Deduplicates by PID+port (IPv4/IPv6 both bind to same port).
 */
export function parseLsofOutput(stdout: string): PortInfo[] {
	if (!stdout.trim()) return [];

	const lines = stdout.split('\n');
	// First line is the header
	if (lines.length < 2) return [];

	const seen = new Set<string>();
	const ports: PortInfo[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		// Only include LISTEN entries -- `(LISTEN)` appears at end of NAME field
		if (!line.includes('(LISTEN)')) continue;

		// lsof -i -P -n output columns:
		// COMMAND  PID  USER  FD  TYPE  DEVICE  SIZE/OFF  NODE  NAME
		const parts = line.split(/\s+/);
		if (parts.length < 9) continue;

		const command = parts[0];
		const pid = parseInt(parts[1], 10);
		const user = parts[2];
		// NODE is the protocol (TCP/UDP)
		const protocol = parts[7];
		// NAME is the rest (address:port (LISTEN))
		const name = parts.slice(8).join(' ');

		if (isNaN(pid)) continue;

		// Extract port from NAME: e.g. "*:3000 (LISTEN)" or "127.0.0.1:8080 (LISTEN)"
		const addrMatch = name.match(/^(.+?):(\d+)\s+\(LISTEN\)$/);
		if (!addrMatch) continue;

		const address = `${addrMatch[1]}:${addrMatch[2]}`;
		const port = parseInt(addrMatch[2], 10);
		if (isNaN(port)) continue;

		// Dedup by PID+port (IPv4 and IPv6 entries for same process)
		const dedupKey = `${pid}:${port}`;
		if (seen.has(dedupKey)) continue;
		seen.add(dedupKey);

		ports.push({ command, pid, user, port, protocol, address });
	}

	// Sort by port number
	ports.sort((a, b) => a.port - b.port);
	return ports;
}

// ─── Cache ──────────────────────────────────────────────────

interface CacheEntry {
	ports: PortInfo[];
	timestamp: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
let portCache: CacheEntry | null = null;

/**
 * Get listening ports, with 30s server-side cache.
 * @param forceRefresh - bypass cache (triggered by ?refresh=1)
 */
export async function getListeningPorts(forceRefresh = false): Promise<{
	ports: PortInfo[];
	cached: boolean;
	error: string | null;
}> {
	// Platform check
	if (process.platform !== 'darwin') {
		return {
			ports: [],
			cached: false,
			error: 'Port scanning is only supported on macOS.'
		};
	}

	// Check cache (unless bypass requested)
	if (!forceRefresh && portCache && Date.now() - portCache.timestamp < CACHE_TTL_MS) {
		return { ports: portCache.ports, cached: true, error: null };
	}

	const result = await execLsof();

	if (result.timedOut) {
		warn('ports', 'lsof timed out', { 'exec.timeout_ms': LSOF_TIMEOUT_MS });
		return { ports: [], cached: false, error: 'lsof timed out. Try again.' };
	}

	// lsof may fail if no network connections exist (exit code 1 with no output)
	// or if the binary is not available
	if (result.exitCode !== 0 && !result.stdout.trim()) {
		const errMsg = result.stderr.trim() || 'lsof returned no data';
		warn('ports', 'lsof failed', {
			'exec.exit_code': result.exitCode,
			'exec.stderr': errMsg
		});
		return { ports: [], cached: false, error: errMsg };
	}

	const ports = parseLsofOutput(result.stdout);

	// Update cache
	portCache = { ports, timestamp: Date.now() };

	return { ports, cached: false, error: null };
}

/**
 * Clear the port cache (useful for testing).
 */
export function clearPortCache(): void {
	portCache = null;
}
