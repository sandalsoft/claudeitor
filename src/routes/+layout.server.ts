// Root layout server load function.
// Provides layout-level data available to all pages.

import type { LayoutServerLoad } from './$types';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export const load: LayoutServerLoad = async () => {
	return withSpan(
		'load:layout',
		{
			'code.filepath': 'src/routes/+layout.server.ts',
			'http.route': '/'
		},
		async () => {
			// Placeholder counts for footer display.
			// Future tasks will populate these from real data readers.
			return {
				pluginCount: 0,
				hookCount: 0
			};
		}
	);
};
