<script lang="ts">
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { formatCurrency, chartColor } from '$lib/utils/chart-helpers';
	import ChartTooltip from './ChartTooltip.svelte';

	interface ModelCost {
		modelId: string;
		pricingKey: string;
		totalCostUSD: number;
		inputCostUSD: number;
		outputCostUSD: number;
		cacheReadCostUSD: number;
		cacheWriteCostUSD: number;
		totalTokens: number;
	}

	interface DailyCost {
		date: string;
		totalCostUSD: number;
		byModel: Record<string, number>;
	}

	interface Props {
		data: ModelCost[];
		daily: DailyCost[];
		class?: string;
	}

	const { data, daily, class: className = '' }: Props = $props();

	let containerWidth = $state(0);
	let containerEl: HTMLDivElement | undefined = $state();

	const MAX_MODELS = 6;

	// Unique ID prefix for SVG filters/gradients
	const uid = `radar-${Math.random().toString(36).slice(2, 8)}`;

	// ── Dimension labels ──────────────────────────────────────
	const DIMENSIONS = [
		{ key: 'totalSpend', label: 'Total Spend' },
		{ key: 'inputRate', label: 'Input Cost Rate' },
		{ key: 'outputRate', label: 'Output Cost Rate' },
		{ key: 'cacheEfficiency', label: 'Cache Efficiency' },
		{ key: 'usageFrequency', label: 'Usage Frequency' }
	] as const;

	const AXIS_COUNT = DIMENSIONS.length;
	const ANGLE_STEP = (2 * Math.PI) / AXIS_COUNT;
	// Start from top (negative Y axis), rotating clockwise
	const START_ANGLE = -Math.PI / 2;

	// ── Layout ────────────────────────────────────────────────
	const PADDING = 48; // space for axis labels
	const LEGEND_HEIGHT = 36;

	const radius = $derived(Math.max((Math.min(containerWidth, 500) - PADDING * 2) / 2, 60));
	const centerX = $derived(Math.max(containerWidth / 2, radius + PADDING));
	const centerY = $derived(radius + PADDING);
	const svgHeight = $derived(centerY + radius + PADDING + LEGEND_HEIGHT);

	// ── Data processing ───────────────────────────────────────

	// Filter to top N models by total cost
	const topModels = $derived(
		[...data]
			.filter((d) => d.totalCostUSD > 0)
			.sort((a, b) => b.totalCostUSD - a.totalCostUSD)
			.slice(0, MAX_MODELS)
	);

	const isEmpty = $derived(topModels.length === 0);

	// Usage frequency: count distinct days each model appears in daily data
	const usageFreqMap = $derived.by(() => {
		const freq = new Map<string, number>();
		for (const day of daily) {
			for (const key of Object.keys(day.byModel)) {
				freq.set(key, (freq.get(key) ?? 0) + 1);
			}
		}
		return freq;
	});

	// Compute raw dimension values for each model
	interface ModelDimensions {
		totalSpend: number;
		inputRate: number;
		outputRate: number;
		cacheEfficiency: number;
		usageFrequency: number;
	}

	const rawDimensions = $derived.by((): ModelDimensions[] => {
		return topModels.map((m) => {
			const totalTokens = m.totalTokens || 1; // avoid division by zero
			const totalCost = m.totalCostUSD || 0.001;
			const cacheCost = m.cacheReadCostUSD + m.cacheWriteCostUSD;

			return {
				totalSpend: m.totalCostUSD,
				inputRate: m.inputCostUSD / totalTokens,
				outputRate: m.outputCostUSD / totalTokens,
				// Higher cache ratio = more efficient, invert so higher = better
				cacheEfficiency: 1 - Math.min(cacheCost / totalCost, 1),
				usageFrequency: usageFreqMap.get(m.pricingKey) ?? 0
			};
		});
	});

	// Normalize each dimension to [0,1] against the max across all models
	type DimKey = keyof ModelDimensions;

	const normalizedDimensions = $derived.by((): number[][] => {
		if (rawDimensions.length === 0) return [];

		const keys: DimKey[] = ['totalSpend', 'inputRate', 'outputRate', 'cacheEfficiency', 'usageFrequency'];
		const maxes: Record<DimKey, number> = {
			totalSpend: 0,
			inputRate: 0,
			outputRate: 0,
			cacheEfficiency: 0,
			usageFrequency: 0
		};

		for (const dim of rawDimensions) {
			for (const k of keys) {
				if (dim[k] > maxes[k]) maxes[k] = dim[k];
			}
		}

		return rawDimensions.map((dim) =>
			keys.map((k) => {
				const max = maxes[k];
				return max > 0 ? dim[k] / max : 0;
			})
		);
	});

	// ── Animated polygon values ───────────────────────────────

	// Flatten all normalized values into a single array for tweening
	const flatTarget = $derived(normalizedDimensions.flat());

	const animatedValues = tweened<number[]>([], {
		duration: 800,
		easing: cubicOut
	});

	// Track whether we've ever set values (for initial mount animation)
	let hasInitialized = $state(false);

	$effect(() => {
		if (flatTarget.length === 0) {
			animatedValues.set([], { duration: 0 });
			hasInitialized = false;
			return;
		}

		if (!hasInitialized) {
			// Start from center (all zeros) for mount animation
			animatedValues.set(new Array(flatTarget.length).fill(0), { duration: 0 });
			hasInitialized = true;
			// Animate to target values
			animatedValues.set(flatTarget);
		} else {
			animatedValues.set(flatTarget);
		}
	});

	// Reshape flat animated values back to per-model arrays
	const animatedPerModel = $derived.by((): number[][] => {
		const vals = $animatedValues;
		if (vals.length === 0 || topModels.length === 0) return [];

		const result: number[][] = [];
		for (let m = 0; m < topModels.length; m++) {
			const start = m * AXIS_COUNT;
			result.push(vals.slice(start, start + AXIS_COUNT));
		}
		return result;
	});

	// ── Geometry helpers ──────────────────────────────────────

	function axisAngle(index: number): number {
		return START_ANGLE + index * ANGLE_STEP;
	}

	function polarToCartesian(angle: number, r: number): { x: number; y: number } {
		return {
			x: centerX + r * Math.cos(angle),
			y: centerY + r * Math.sin(angle)
		};
	}

	// Axis endpoints (at full radius)
	const axisEndpoints = $derived(
		Array.from({ length: AXIS_COUNT }, (_, i) => polarToCartesian(axisAngle(i), radius))
	);

	// Label positions (slightly beyond radius)
	const labelPositions = $derived(
		Array.from({ length: AXIS_COUNT }, (_, i) => {
			const angle = axisAngle(i);
			const labelR = radius + 18;
			const pos = polarToCartesian(angle, labelR);
			// Determine text-anchor based on horizontal position
			const cos = Math.cos(angle);
			let anchor: 'start' | 'middle' | 'end' = 'middle';
			if (cos > 0.3) anchor = 'start';
			else if (cos < -0.3) anchor = 'end';
			return { ...pos, anchor };
		})
	);

	// Grid circle levels (25%, 50%, 75%, 100%)
	const GRID_LEVELS = [0.25, 0.5, 0.75, 1.0];

	// Build polygon path from animated values
	function polygonPath(values: number[]): string {
		if (values.length !== AXIS_COUNT) return '';
		const points = values.map((v, i) => {
			const angle = axisAngle(i);
			const r = v * radius;
			return polarToCartesian(angle, r);
		});
		return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
	}

	// Vertex positions for data points
	function vertexPositions(values: number[]): Array<{ x: number; y: number; value: number }> {
		if (values.length !== AXIS_COUNT) return [];
		return values.map((v, i) => {
			const angle = axisAngle(i);
			const r = v * radius;
			const pos = polarToCartesian(angle, r);
			return { ...pos, value: v };
		});
	}

	// ── Grid circle paths ─────────────────────────────────────
	const gridPaths = $derived(
		GRID_LEVELS.map((level) => {
			const r = level * radius;
			const pts = Array.from({ length: AXIS_COUNT }, (_, i) => {
				const angle = axisAngle(i);
				return polarToCartesian(angle, r);
			});
			return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
		})
	);

	// ── Interactivity ─────────────────────────────────────────

	let hoveredModelIndex: number | null = $state(null);
	let hoveredAxisIndex: number | null = $state(null);
	let hiddenModels = $state(new Set<number>());

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	function handlePolygonEnter(event: MouseEvent, modelIdx: number) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
		hoveredModelIndex = modelIdx;
		tooltipVisible = true;
	}

	function handlePolygonMove(event: MouseEvent) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
	}

	function handlePolygonLeave() {
		hoveredModelIndex = null;
		tooltipVisible = false;
	}

	function handleAxisEnter(axisIdx: number) {
		hoveredAxisIndex = axisIdx;
	}

	function handleAxisLeave() {
		hoveredAxisIndex = null;
	}

	function toggleModel(modelIdx: number) {
		const next = new Set(hiddenModels);
		if (next.has(modelIdx)) {
			next.delete(modelIdx);
		} else {
			next.add(modelIdx);
		}
		hiddenModels = next;
	}

	// Format raw dimension values for the tooltip
	type DimensionKey = typeof DIMENSIONS[number]['key'];

	function formatDimensionValue(key: DimensionKey, modelIdx: number): string {
		if (!rawDimensions[modelIdx]) return '-';
		const raw = rawDimensions[modelIdx];
		switch (key) {
			case 'totalSpend':
				return formatCurrency(raw.totalSpend);
			case 'inputRate':
				return `$${(raw.inputRate * 1_000_000).toFixed(2)}/M`;
			case 'outputRate':
				return `$${(raw.outputRate * 1_000_000).toFixed(2)}/M`;
			case 'cacheEfficiency':
				return `${((1 - raw.cacheEfficiency) * 100).toFixed(1)}% cache`;
			case 'usageFrequency':
				return `${raw.usageFrequency} days`;
			default:
				return '-';
		}
	}

	// HSL parse helper for gradient stops
	function parseHSL(hsl: string): { h: number; s: number; l: number } | null {
		const match = hsl.match(/hsl\((\d+)\s+([\d.]+)%\s+([\d.]+)%\)/);
		if (!match) return null;
		return { h: parseInt(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
	}
</script>

<div class="relative {className}" bind:this={containerEl} bind:clientWidth={containerWidth}>
	{#if isEmpty}
		<div
			class="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
			style="height: 300px;"
		>
			No cost data available
		</div>
	{:else}
		<svg
			width={Math.max(containerWidth, 200)}
			height={svgHeight}
			class="overflow-visible"
		>
			<!-- SVG filter for vertex glow effect -->
			<defs>
				<filter id="{uid}-glow" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>

				<!-- Radial gradients for each model polygon -->
				{#each topModels as _, i (i)}
					{@const color = chartColor(i)}
					{@const parsed = parseHSL(color)}
					<radialGradient id="{uid}-grad-{i}" cx="50%" cy="50%" r="50%">
						<stop
							offset="0%"
							stop-color={parsed ? `hsl(${parsed.h} ${parsed.s}% ${parsed.l}%)` : color}
							stop-opacity="0.05"
						/>
						<stop
							offset="100%"
							stop-color={parsed ? `hsl(${parsed.h} ${parsed.s}% ${parsed.l}%)` : color}
							stop-opacity="0.3"
						/>
					</radialGradient>
				{/each}
			</defs>

			<!-- Grid circles (concentric polygons) -->
			{#each gridPaths as path, i (i)}
				<path
					d={path}
					fill="none"
					stroke="var(--color-border)"
					stroke-width="0.5"
					stroke-dasharray={i < GRID_LEVELS.length - 1 ? '3,3' : 'none'}
					opacity="0.5"
				/>
			{/each}

			<!-- Axis lines from center to each vertex -->
			{#each axisEndpoints as ep, i (i)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<line
					x1={centerX}
					y1={centerY}
					x2={ep.x}
					y2={ep.y}
					stroke="var(--color-border)"
					stroke-width={hoveredAxisIndex === i ? 1.5 : 0.5}
					opacity={hoveredAxisIndex === i ? 0.8 : 0.4}
					class="transition-all duration-150"
					onmouseenter={() => handleAxisEnter(i)}
					onmouseleave={handleAxisLeave}
				/>
			{/each}

			<!-- Axis labels -->
			{#each DIMENSIONS as dim, i (dim.key)}
				{@const pos = labelPositions[i]}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<text
					x={pos.x}
					y={pos.y}
					text-anchor={pos.anchor}
					dominant-baseline="central"
					font-size="11"
					fill={hoveredAxisIndex === i ? 'var(--color-foreground)' : 'var(--color-muted-foreground)'}
					font-weight={hoveredAxisIndex === i ? '600' : '400'}
					class="cursor-default select-none transition-all duration-150"
					onmouseenter={() => handleAxisEnter(i)}
					onmouseleave={handleAxisLeave}
				>
					{dim.label}
				</text>
			{/each}

			<!-- Model polygons (bottom-to-top so hovered is on top) -->
			{#each topModels as model, modelIdx (model.pricingKey)}
				{@const values = animatedPerModel[modelIdx] ?? []}
				{@const path = polygonPath(values)}
				{@const vertices = vertexPositions(values)}
				{@const color = chartColor(modelIdx)}
				{@const isHovered = hoveredModelIndex === modelIdx}
				{@const isHidden = hiddenModels.has(modelIdx)}
				{@const dimmed = hoveredModelIndex !== null && !isHovered}

				{#if !isHidden && path}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<g
						class="cursor-default"
						style={isHovered ? 'z-index: 10;' : ''}
						onmouseenter={(e) => handlePolygonEnter(e, modelIdx)}
						onmousemove={handlePolygonMove}
						onmouseleave={handlePolygonLeave}
					>
						<!-- Gradient fill polygon -->
						<path
							d={path}
							fill="url(#{uid}-grad-{modelIdx})"
							stroke={color}
							stroke-width={isHovered ? 2 : 1.2}
							stroke-opacity={dimmed ? 0.2 : isHovered ? 1 : 0.7}
							fill-opacity={dimmed ? 0.08 : isHovered ? 1 : 0.6}
							class="transition-all duration-200"
						/>

						<!-- Glowing data point vertices -->
						{#each vertices as v, vi (vi)}
							<circle
								cx={v.x}
								cy={v.y}
								r={isHovered ? 4.5 : 3}
								fill={color}
								fill-opacity={dimmed ? 0.2 : isHovered ? 1 : 0.8}
								stroke="white"
								stroke-width={isHovered ? 1.5 : 0.8}
								stroke-opacity={dimmed ? 0.1 : 0.6}
								filter={isHovered ? `url(#${uid}-glow)` : 'none'}
								class="transition-all duration-200"
							/>
						{/each}
					</g>
				{/if}
			{/each}

			<!-- Axis dimension highlights (small circles at each level when axis is hovered) -->
			{#if hoveredAxisIndex !== null}
				{@const angle = axisAngle(hoveredAxisIndex)}
				{#each topModels as _, modelIdx (modelIdx)}
					{@const values = animatedPerModel[modelIdx] ?? []}
					{@const v = values[hoveredAxisIndex] ?? 0}
					{@const isHidden = hiddenModels.has(modelIdx)}
					{#if !isHidden}
						{@const pos = polarToCartesian(angle, v * radius)}
						<circle
							cx={pos.x}
							cy={pos.y}
							r="5"
							fill={chartColor(modelIdx)}
							fill-opacity="0.9"
							stroke="var(--color-foreground)"
							stroke-width="1.5"
							stroke-opacity="0.5"
							class="pointer-events-none"
						/>
					{/if}
				{/each}
			{/if}
		</svg>

		<!-- Legend with toggleable model visibility -->
		<div class="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-1">
			{#each topModels as model, i (model.pricingKey)}
				{@const isHidden = hiddenModels.has(i)}
				<button
					onclick={() => toggleModel(i)}
					class="flex items-center gap-1.5 text-xs transition-opacity
						{isHidden ? 'opacity-40' : 'opacity-100'}
						hover:opacity-80"
				>
					<span
						class="h-2 w-2 shrink-0 rounded-full"
						style="background: {chartColor(i)}; {isHidden ? 'opacity: 0.3;' : ''}"
					></span>
					<span class="text-muted-foreground {isHidden ? 'line-through' : ''}">{model.pricingKey}</span>
				</button>
			{/each}
		</div>

		<ChartTooltip visible={tooltipVisible} x={tooltipX} y={tooltipY}>
			{#if hoveredModelIndex !== null && topModels[hoveredModelIndex]}
				{@const model = topModels[hoveredModelIndex]}
				<p class="font-medium text-foreground">{model.pricingKey}</p>
				<div class="mt-1.5 space-y-0.5 border-t border-border pt-1.5">
					{#each DIMENSIONS as dim, di (dim.key)}
						{@const normalized = normalizedDimensions[hoveredModelIndex]?.[di] ?? 0}
						<div class="flex items-center justify-between gap-3">
							<span class="text-muted-foreground">{dim.label}</span>
							<span class="tabular-nums text-foreground">
								{formatDimensionValue(dim.key, hoveredModelIndex)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</ChartTooltip>
	{/if}
</div>
