import type { PortInfo } from '$lib/data/types';
import { warn } from '$lib/server/telemetry/logger';
import { safeExecFile, type ExecResult } from './exec.js';

// Re-export for backwards compatibility
export type { ExecResult } from './exec.js';
export { safeExecFile } from './exec.js';

const LSOF_TIMEOUT_MS = 5000;

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
