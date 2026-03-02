import { describe, it, expect } from 'vitest';
import { parseLsofOutput } from './ports.js';

// ─── parseLsofOutput (pure parsing, fixture strings) ─────────

const SAMPLE_LSOF_OUTPUT = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      12345  eric   22u  IPv4 0x1234567890     0t0  TCP *:3000 (LISTEN)
node      12345  eric   23u  IPv6 0x1234567891     0t0  TCP *:3000 (LISTEN)
node      12346  eric   24u  IPv4 0x1234567892     0t0  TCP 127.0.0.1:8080 (LISTEN)
nginx      5678  root   10u  IPv4 0x1234567893     0t0  TCP *:80 (LISTEN)
nginx      5678  root   11u  IPv6 0x1234567894     0t0  TCP *:80 (LISTEN)
postgres   9012  eric   12u  IPv4 0x1234567895     0t0  TCP 127.0.0.1:5432 (LISTEN)
node      12345  eric   25u  IPv4 0x1234567896     0t0  TCP *:3000 (ESTABLISHED)
chrome    45678  eric   30u  IPv4 0x1234567897     0t0  TCP 192.168.1.10:52341->142.250.80.46:443 (ESTABLISHED)`;

describe('parseLsofOutput', () => {
	it('parses listening ports correctly', () => {
		const ports = parseLsofOutput(SAMPLE_LSOF_OUTPUT);

		// Should find: node:3000, node:8080, nginx:80, postgres:5432
		// node:3000 IPv6 is deduped, node ESTABLISHED is excluded
		expect(ports).toHaveLength(4);
	});

	it('deduplicates IPv4/IPv6 entries by PID+port', () => {
		const ports = parseLsofOutput(SAMPLE_LSOF_OUTPUT);

		// node PID 12345 on port 3000 should appear only once
		const node3000 = ports.filter((p) => p.pid === 12345 && p.port === 3000);
		expect(node3000).toHaveLength(1);

		// nginx PID 5678 on port 80 should appear only once
		const nginx80 = ports.filter((p) => p.pid === 5678 && p.port === 80);
		expect(nginx80).toHaveLength(1);
	});

	it('excludes non-LISTEN entries', () => {
		const ports = parseLsofOutput(SAMPLE_LSOF_OUTPUT);

		// No ESTABLISHED connections should be included
		const established = ports.filter((p) => p.port === 52341);
		expect(established).toHaveLength(0);

		// No ESTABLISHED node connection
		const nodeEstablished = ports.filter(
			(p) => p.command === 'node' && p.port === 3000
		);
		expect(nodeEstablished).toHaveLength(1); // Only the LISTEN one
	});

	it('extracts correct fields', () => {
		const ports = parseLsofOutput(SAMPLE_LSOF_OUTPUT);

		const node8080 = ports.find((p) => p.port === 8080);
		expect(node8080).toBeDefined();
		expect(node8080!.command).toBe('node');
		expect(node8080!.pid).toBe(12346);
		expect(node8080!.user).toBe('eric');
		expect(node8080!.protocol).toBe('TCP');
		expect(node8080!.address).toBe('127.0.0.1:8080');
	});

	it('sorts results by port number', () => {
		const ports = parseLsofOutput(SAMPLE_LSOF_OUTPUT);
		const portNumbers = ports.map((p) => p.port);
		expect(portNumbers).toEqual([...portNumbers].sort((a, b) => a - b));
	});

	it('returns empty array for empty input', () => {
		expect(parseLsofOutput('')).toEqual([]);
	});

	it('returns empty array for header-only output', () => {
		expect(
			parseLsofOutput(
				'COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME'
			)
		).toEqual([]);
	});

	it('handles single LISTEN entry', () => {
		const single = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
vite       9999  eric   20u  IPv4 0x1234567890     0t0  TCP *:5173 (LISTEN)`;

		const ports = parseLsofOutput(single);
		expect(ports).toHaveLength(1);
		expect(ports[0].command).toBe('vite');
		expect(ports[0].port).toBe(5173);
		expect(ports[0].address).toBe('*:5173');
	});

	it('handles different address formats', () => {
		const multiAddr = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      10001  eric   20u  IPv4 0x1234567890     0t0  TCP *:3000 (LISTEN)
redis     10002  eric   21u  IPv4 0x1234567891     0t0  TCP 127.0.0.1:6379 (LISTEN)
pg        10003  eric   22u  IPv4 0x1234567892     0t0  TCP 0.0.0.0:5432 (LISTEN)`;

		const ports = parseLsofOutput(multiAddr);
		expect(ports).toHaveLength(3);

		expect(ports.find((p) => p.port === 3000)!.address).toBe('*:3000');
		expect(ports.find((p) => p.port === 6379)!.address).toBe('127.0.0.1:6379');
		expect(ports.find((p) => p.port === 5432)!.address).toBe('0.0.0.0:5432');
	});

	it('keeps different PIDs on the same port (conflict)', () => {
		const conflict = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      10001  eric   20u  IPv4 0x1234567890     0t0  TCP *:3000 (LISTEN)
deno      10002  eric   21u  IPv4 0x1234567891     0t0  TCP *:3000 (LISTEN)`;

		const ports = parseLsofOutput(conflict);
		expect(ports).toHaveLength(2); // Different PIDs = different entries
	});
});
