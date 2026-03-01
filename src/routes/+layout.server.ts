// Root layout server load function.
// Provides layout-level data available to all pages.

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	// Placeholder counts for footer display.
	// Future tasks will populate these from real data readers.
	return {
		pluginCount: 0,
		hookCount: 0
	};
};
