<script lang="ts">
	import * as d3 from 'd3';
	import { formatCurrency, formatDateShort } from '$lib/utils/chart-helpers';
	import ChartTooltip from './ChartTooltip.svelte';

	interface DailyCost {
		date: string;
		totalCostUSD: number;
		byModel: Record<string, number>;
	}

	interface Props {
		data: DailyCost[];
		class?: string;
	}

	const { data, class: className = '' }: Props = $props();

	let containerWidth = $state(0);
	let containerEl: HTMLDivElement | undefined = $state();

	// Day-of-week labels (Monday-first like GitHub)
	const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'] as const;
	const DAY_LABEL_WIDTH = 32;
	const MONTH_LABEL_HEIGHT = 16;
	const CELL_GAP = 2;
	const CELL_RADIUS = 3;

	// Build a lookup from date string to cost
	const costMap = $derived.by(() => {
		const map = new Map<string, number>();
		for (const d of data) {
			map.set(d.date, d.totalCostUSD);
		}
		return map;
	});

	// Determine date range: from earliest date in data to today
	const dateRange = $derived.by(() => {
		if (data.length === 0) return { start: new Date(), end: new Date(), days: [] as Date[] };

		const dates = data.map((d) => new Date(d.date + 'T00:00:00'));
		const earliest = d3.min(dates) ?? new Date();
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Align start to Monday of the week containing the earliest date
		const start = new Date(earliest);
		const dow = start.getDay(); // 0=Sun, 1=Mon, ...
		const mondayOffset = dow === 0 ? -6 : 1 - dow;
		start.setDate(start.getDate() + mondayOffset);

		// Generate all days from aligned start to today
		const days: Date[] = [];
		const cursor = new Date(start);
		while (cursor <= today) {
			days.push(new Date(cursor));
			cursor.setDate(cursor.getDate() + 1);
		}

		return { start, end: today, days };
	});

	const isEmpty = $derived(data.length === 0 || data.every((d) => d.totalCostUSD === 0));

	// Today's date string for highlight comparison
	const todayStr = $derived.by(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	});

	// Compute max daily cost for color scale domain
	const maxCost = $derived(d3.max(data, (d) => d.totalCostUSD) ?? 1);

	// Color scale: sequential from pale yellow to deep red
	const colorScale = $derived(
		d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxCost])
	);

	// Adaptive cell size based on container width and number of weeks
	const numWeeks = $derived(Math.ceil(dateRange.days.length / 7) || 1);

	const cellSize = $derived.by(() => {
		const available = Math.max(containerWidth - DAY_LABEL_WIDTH - 8, 100);
		const maxCellFromWidth = Math.floor((available - (numWeeks - 1) * CELL_GAP) / numWeeks);
		// Clamp between 8px and 18px for readability
		return Math.max(8, Math.min(18, maxCellFromWidth));
	});

	const svgWidth = $derived(
		DAY_LABEL_WIDTH + numWeeks * cellSize + (numWeeks - 1) * CELL_GAP
	);
	const svgHeight = $derived(
		MONTH_LABEL_HEIGHT + 7 * cellSize + 6 * CELL_GAP
	);

	// Grid cells: each day gets a week column (x) and day-of-week row (y)
	interface CellData {
		date: string;
		dateObj: Date;
		cost: number;
		weekCol: number;
		dayRow: number; // 0=Mon, 6=Sun
		isToday: boolean;
		hasCost: boolean;
	}

	const cells = $derived.by((): CellData[] => {
		if (dateRange.days.length === 0) return [];

		const startTime = dateRange.start.getTime();

		return dateRange.days.map((d) => {
			const daysSinceStart = Math.round((d.getTime() - startTime) / (24 * 60 * 60 * 1000));
			const weekCol = Math.floor(daysSinceStart / 7);

			// Convert JS day (0=Sun) to Monday-first row (0=Mon, 6=Sun)
			const jsDow = d.getDay();
			const dayRow = jsDow === 0 ? 6 : jsDow - 1;

			const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			const cost = costMap.get(dateStr) ?? 0;

			return {
				date: dateStr,
				dateObj: d,
				cost,
				weekCol,
				dayRow,
				isToday: dateStr === todayStr,
				hasCost: cost > 0
			};
		});
	});

	// Month labels: emit a label at the first week of each month
	interface MonthLabel {
		label: string;
		x: number;
	}

	const monthLabels = $derived.by((): MonthLabel[] => {
		if (cells.length === 0) return [];

		const labels: MonthLabel[] = [];
		let lastMonth = -1;

		for (const cell of cells) {
			const month = cell.dateObj.getMonth();
			if (month !== lastMonth && cell.dayRow === 0) {
				labels.push({
					label: cell.dateObj.toLocaleDateString('en-US', { month: 'short' }),
					x: DAY_LABEL_WIDTH + cell.weekCol * (cellSize + CELL_GAP)
				});
				lastMonth = month;
			}
		}

		return labels;
	});

	// Format a date string as full day label (e.g. "Monday, Jan 15, 2025")
	function formatFullDate(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let hoveredCell: CellData | null = $state(null);

	function handleCellEnter(event: MouseEvent, cell: CellData) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
		hoveredCell = cell;
		tooltipVisible = true;
	}

	function handleCellMove(event: MouseEvent) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
	}

	function handleCellLeave() {
		tooltipVisible = false;
		hoveredCell = null;
	}

	// Cell fill color
	function cellFill(cell: CellData): string {
		if (!cell.hasCost) return 'var(--color-muted)';
		return colorScale(cell.cost);
	}

	// Cell fill opacity
	function cellFillOpacity(cell: CellData): number {
		if (!cell.hasCost) return 0.25;
		// Ensure minimum visibility for very low costs
		return Math.max(0.4, cell.cost / maxCost);
	}
</script>

<style>
	@keyframes heatmap-pulse {
		0%,
		100% {
			stroke-opacity: 0.9;
			stroke-width: 2;
		}
		50% {
			stroke-opacity: 0.3;
			stroke-width: 1;
		}
	}

	.heatmap-today {
		animation: heatmap-pulse 2s ease-in-out infinite;
	}
</style>

<div class="relative {className}" bind:this={containerEl} bind:clientWidth={containerWidth}>
	{#if isEmpty}
		<div
			class="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
			style="height: {svgHeight + 8}px;"
		>
			No cost data available
		</div>
	{:else}
		<svg width={svgWidth} height={svgHeight} class="overflow-visible">
			<!-- Month labels across the top -->
			{#each monthLabels as ml (ml.label + ml.x)}
				<text
					x={ml.x}
					y={MONTH_LABEL_HEIGHT - 4}
					font-size="10"
					fill="var(--color-muted-foreground)"
				>
					{ml.label}
				</text>
			{/each}

			<!-- Day-of-week labels on the Y axis -->
			{#each DAY_LABELS as label, i (i)}
				{#if label}
					<text
						x={DAY_LABEL_WIDTH - 6}
						y={MONTH_LABEL_HEIGHT + i * (cellSize + CELL_GAP) + cellSize / 2}
						font-size="10"
						fill="var(--color-muted-foreground)"
						text-anchor="end"
						dominant-baseline="central"
					>
						{label}
					</text>
				{/if}
			{/each}

			<!-- Heatmap cells -->
			{#each cells as cell (cell.date)}
				{@const cx = DAY_LABEL_WIDTH + cell.weekCol * (cellSize + CELL_GAP)}
				{@const cy = MONTH_LABEL_HEIGHT + cell.dayRow * (cellSize + CELL_GAP)}
				{@const isHovered = hoveredCell?.date === cell.date}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<rect
					x={cx}
					y={cy}
					width={cellSize}
					height={cellSize}
					rx={CELL_RADIUS}
					fill={cellFill(cell)}
					fill-opacity={cellFillOpacity(cell)}
					stroke={isHovered
						? 'var(--color-foreground)'
						: cell.isToday
							? 'var(--color-primary)'
							: 'none'}
					stroke-width={isHovered ? 1.5 : cell.isToday ? 2 : 0}
					stroke-opacity={isHovered ? 0.8 : cell.isToday ? 0.9 : 0}
					class="cursor-default transition-[fill-opacity] duration-150 {cell.isToday && !isHovered
						? 'heatmap-today'
						: ''}"
					onmouseenter={(e) => handleCellEnter(e, cell)}
					onmousemove={handleCellMove}
					onmouseleave={handleCellLeave}
				/>
			{/each}
		</svg>

		<!-- Color scale legend -->
		<div class="mt-3 flex items-center gap-2 px-1">
			<span class="text-[10px] text-muted-foreground">Less</span>
			{#each [0, 0.25, 0.5, 0.75, 1] as pct (pct)}
				<div
					class="h-2.5 w-2.5 rounded-sm"
					style="background: {colorScale(pct * maxCost)}; opacity: {Math.max(0.4, pct)};"
				></div>
			{/each}
			<span class="text-[10px] text-muted-foreground">More</span>
		</div>

		<ChartTooltip visible={tooltipVisible} x={tooltipX} y={tooltipY}>
			{#if hoveredCell}
				<p class="font-medium text-foreground">{formatFullDate(hoveredCell.date)}</p>
				<div class="mt-1 space-y-0.5 border-t border-border pt-1">
					<div class="flex items-center justify-between gap-3">
						<span class="text-muted-foreground">Cost</span>
						<span class="tabular-nums font-medium text-foreground">
							{hoveredCell.hasCost ? formatCurrency(hoveredCell.cost) : '$0.00'}
						</span>
					</div>
				</div>
			{/if}
		</ChartTooltip>
	{/if}
</div>
