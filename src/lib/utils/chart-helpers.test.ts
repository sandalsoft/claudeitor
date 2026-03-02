import { describe, it, expect } from 'vitest';
import {
	formatCurrency,
	formatNumber,
	formatDateShort,
	formatHour,
	computeDimensions,
	chartColor,
	CHART_COLORS
} from './chart-helpers';

describe('formatCurrency', () => {
	it('formats values under $10 with two decimals', () => {
		expect(formatCurrency(0)).toBe('$0.00');
		expect(formatCurrency(1.5)).toBe('$1.50');
		expect(formatCurrency(9.99)).toBe('$9.99');
	});

	it('formats values $10-$99 with one decimal', () => {
		expect(formatCurrency(10)).toBe('$10.0');
		expect(formatCurrency(42.75)).toBe('$42.8');
	});

	it('formats values $100-$999 with no decimals', () => {
		expect(formatCurrency(100)).toBe('$100');
		expect(formatCurrency(999.5)).toBe('$1000');
	});

	it('formats values >= $1000 with K suffix', () => {
		expect(formatCurrency(1000)).toBe('$1.0K');
		expect(formatCurrency(2500)).toBe('$2.5K');
		expect(formatCurrency(12345)).toBe('$12.3K');
	});
});

describe('formatNumber', () => {
	it('formats small numbers with locale separators', () => {
		expect(formatNumber(0)).toBe('0');
		expect(formatNumber(42)).toBe('42');
		expect(formatNumber(999)).toBe('999');
	});

	it('formats thousands with K suffix', () => {
		expect(formatNumber(1000)).toBe('1.0K');
		expect(formatNumber(2500)).toBe('2.5K');
		expect(formatNumber(999999)).toBe('1000.0K');
	});

	it('formats millions with M suffix', () => {
		expect(formatNumber(1_000_000)).toBe('1.0M');
		expect(formatNumber(3_500_000)).toBe('3.5M');
	});
});

describe('formatDateShort', () => {
	it('formats YYYY-MM-DD as "Mon DD"', () => {
		expect(formatDateShort('2025-01-15')).toBe('Jan 15');
		expect(formatDateShort('2025-12-01')).toBe('Dec 1');
	});
});

describe('formatHour', () => {
	it('formats midnight as 12 AM', () => {
		expect(formatHour(0)).toBe('12 AM');
	});

	it('formats noon as 12 PM', () => {
		expect(formatHour(12)).toBe('12 PM');
	});

	it('formats morning hours', () => {
		expect(formatHour(1)).toBe('1 AM');
		expect(formatHour(11)).toBe('11 AM');
	});

	it('formats afternoon hours', () => {
		expect(formatHour(13)).toBe('1 PM');
		expect(formatHour(23)).toBe('11 PM');
	});
});

describe('computeDimensions', () => {
	const margin = { top: 10, right: 20, bottom: 30, left: 40 };

	it('computes inner dimensions from container width and aspect ratio', () => {
		const dims = computeDimensions(600, 2, margin);
		expect(dims.width).toBe(600);
		expect(dims.height).toBe(300);
		expect(dims.innerWidth).toBe(600 - 40 - 20); // width - left - right
		expect(dims.innerHeight).toBe(300 - 10 - 30); // height - top - bottom
		expect(dims.margin).toEqual(margin);
	});

	it('enforces minimum width of 200', () => {
		const dims = computeDimensions(50, 2, margin);
		expect(dims.width).toBe(200);
	});
});

describe('chartColor', () => {
	it('returns colors from palette by index', () => {
		expect(chartColor(0)).toBe(CHART_COLORS[0]);
		expect(chartColor(1)).toBe(CHART_COLORS[1]);
	});

	it('cycles when index exceeds palette length', () => {
		const paletteLen = CHART_COLORS.length;
		expect(chartColor(paletteLen)).toBe(CHART_COLORS[0]);
		expect(chartColor(paletteLen + 1)).toBe(CHART_COLORS[1]);
	});
});
