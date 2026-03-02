import type { PageServerLoad } from './$types';
import { getListeningPorts } from '$lib/server/system/ports';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export const load: PageServerLoad = async ({ url }) => {
	return withSpan(
		'load:ports',
		{
			'code.filepath': 'src/routes/ports/+page.server.ts',
			'http.route': '/ports'
		},
		async () => {
			const forceRefresh = url.searchParams.get('refresh') === '1';
			const { ports, cached, error } = await getListeningPorts(forceRefresh);

			// Detect port conflicts: multiple processes on the same port
			const portCounts = new Map<number, number>();
			for (const p of ports) {
				portCounts.set(p.port, (portCounts.get(p.port) ?? 0) + 1);
			}
			const conflictPorts = new Set<number>();
			for (const [port, count] of portCounts) {
				if (count > 1) conflictPorts.add(port);
			}

			// Unique process count
			const uniqueProcesses = new Set(ports.map((p) => p.command));

			return {
				ports,
				cached,
				error,
				totalPorts: ports.length,
				conflictCount: conflictPorts.size,
				processCount: uniqueProcesses.size,
				supported: process.platform === 'darwin'
			};
		}
	);
};
