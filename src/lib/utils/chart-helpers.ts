/**
 * Shared chart utilities: formatting, responsive sizing, color palettes.
 * Pure functions -- no side effects, safe for both server and client.
 */

/** Format a number as compact currency (e.g. $1.2K, $0.34). */
export function formatCurrency(value: number): string {
	if (Math.abs(value) >= 1000) {
		return `$${(value / 1000).toFixed(1)}K`;
	}
	if (Math.abs(value) >= 100) {
		return `$${value.toFixed(0)}`;
	}
	if (Math.abs(value) >= 10) {
		return `$${value.toFixed(1)}`;
	}
	return `$${value.toFixed(2)}`;
}

/** Format a number with compact suffixes (1.2K, 3.4M). */
export function formatNumber(value: number): string {
	if (Math.abs(value) >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(1)}M`;
	}
	if (Math.abs(value) >= 1_000) {
		return `${(value / 1_000).toFixed(1)}K`;
	}
	return value.toLocaleString('en-US');
}

/** Format a date string (YYYY-MM-DD) as a short label (e.g. "Jan 15"). */
export function formatDateShort(dateStr: string): string {
	const date = new Date(dateStr + 'T00:00:00');
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format hour number (0-23) as readable label (e.g. "12 AM", "3 PM"). */
export function formatHour(hour: number): string {
	if (hour === 0) return '12 AM';
	if (hour === 12) return '12 PM';
	if (hour < 12) return `${hour} AM`;
	return `${hour - 12} PM`;
}

/**
 * Calculate chart dimensions from container width.
 * Returns inner width/height after applying margins.
 */
export interface ChartMargins {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export interface ChartDimensions {
	width: number;
	height: number;
	innerWidth: number;
	innerHeight: number;
	margin: ChartMargins;
}

export function computeDimensions(
	containerWidth: number,
	aspectRatio: number,
	margin: ChartMargins
): ChartDimensions {
	const width = Math.max(containerWidth, 200);
	const height = Math.round(width / aspectRatio);
	return {
		width,
		height,
		innerWidth: width - margin.left - margin.right,
		innerHeight: height - margin.top - margin.bottom,
		margin
	};
}

/**
 * Categorical color palette. Uses CSS custom properties so charts
 * automatically respect light/dark theme via Tailwind v4 variables.
 *
 * For D3 fills we return actual HSL strings because D3 attr() does not
 * resolve CSS variables. The caller can override with theme-aware logic.
 */
export const CHART_COLORS = [
	'hsl(222 47% 40%)', // primary-ish blue
	'hsl(142 76% 36%)', // success green
	'hsl(38 92% 50%)', // warning amber
	'hsl(0 84% 60%)', // destructive red
	'hsl(262 83% 58%)', // purple
	'hsl(199 89% 48%)', // sky
	'hsl(25 95% 53%)', // orange
	'hsl(330 81% 60%)' // pink
] as const;

/** Get a color from the palette, cycling for overflow. */
export function chartColor(index: number): string {
	return CHART_COLORS[index % CHART_COLORS.length];
}
