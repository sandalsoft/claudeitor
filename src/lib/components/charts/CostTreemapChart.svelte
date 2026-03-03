<script lang="ts">
	import * as d3 from 'd3';
	import { formatCurrency, formatNumber, chartColor } from '$lib/utils/chart-helpers';
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

	interface Props {
		data: ModelCost[];
		class?: string;
	}

	const { data, class: className = '' }: Props = $props();

	let containerWidth = $state(0);
	let containerEl: HTMLDivElement | undefined = $state();

	const ASPECT_RATIO = 1.6;
	const chartHeight = $derived(Math.max(Math.round(Math.max(containerWidth, 200) / ASPECT_RATIO), 200));

	// Filter to models with non-zero cost, sorted by cost descending
	const activeModels = $derived(
		[...data].filter((d) => d.totalCostUSD > 0).sort((a, b) => b.totalCostUSD - a.totalCostUSD)
	);
	const isEmpty = $derived(activeModels.length === 0);
	const totalCost = $derived(activeModels.reduce((sum, d) => sum + d.totalCostUSD, 0));

	// Token type labels and accessors
	const TOKEN_TYPES = [
		{ key: 'input', label: 'Input', accessor: (m: ModelCost) => m.inputCostUSD },
		{ key: 'output', label: 'Output', accessor: (m: ModelCost) => m.outputCostUSD },
		{ key: 'cacheRead', label: 'Cache Read', accessor: (m: ModelCost) => m.cacheReadCostUSD },
		{ key: 'cacheWrite', label: 'Cache Write', accessor: (m: ModelCost) => m.cacheWriteCostUSD }
	] as const;

	// Hierarchy node data shape
	interface TreeNode {
		name: string;
		cost?: number;
		tokens?: number;
		modelIndex?: number;
		tokenType?: string;
		pricingKey?: string;
		children?: TreeNode[];
	}

	// Build hierarchy: root -> model nodes -> token-type leaf nodes
	const hierarchyData = $derived.by((): TreeNode => {
		const children: TreeNode[] = activeModels.map((model, modelIdx) => {
			const leafChildren: TreeNode[] = TOKEN_TYPES
				.filter((t) => t.accessor(model) > 0)
				.map((t) => ({
					name: t.label,
					cost: t.accessor(model),
					tokens: getTokenCount(model, t.key),
					modelIndex: modelIdx,
					tokenType: t.key,
					pricingKey: model.pricingKey
				}));

			return {
				name: model.pricingKey,
				modelIndex: modelIdx,
				pricingKey: model.pricingKey,
				children: leafChildren.length > 0 ? leafChildren : [{ name: 'Total', cost: 0.001, modelIndex: modelIdx, pricingKey: model.pricingKey }]
			};
		});

		return { name: 'root', children };
	});

	function getTokenCount(model: ModelCost, tokenType: string): number {
		// We don't have per-type token counts in ModelCost, only totalTokens.
		// Approximate by distributing totalTokens proportionally to cost.
		const total = model.totalCostUSD;
		if (total === 0) return 0;
		switch (tokenType) {
			case 'input': return Math.round(model.totalTokens * (model.inputCostUSD / total));
			case 'output': return Math.round(model.totalTokens * (model.outputCostUSD / total));
			case 'cacheRead': return Math.round(model.totalTokens * (model.cacheReadCostUSD / total));
			case 'cacheWrite': return Math.round(model.totalTokens * (model.cacheWriteCostUSD / total));
			default: return 0;
		}
	}

	// Compute treemap layout
	const treemapRoot = $derived.by(() => {
		if (activeModels.length === 0) return null;

		const root = d3.hierarchy<TreeNode>(hierarchyData)
			.sum((d) => d.cost ?? 0)
			.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

		d3.treemap<TreeNode>()
			.size([Math.max(containerWidth, 200), chartHeight])
			.paddingInner(2)
			.paddingOuter(4)
			.tile(d3.treemapSquarify)
			(root);

		return root;
	});

	// Extract leaf nodes for rendering
	const leaves = $derived(treemapRoot?.leaves() ?? []);

	// Color helpers: base color from chartColor, variants for token types
	function leafColor(leaf: d3.HierarchyRectangularNode<TreeNode>): string {
		const modelIdx = leaf.data.modelIndex ?? 0;
		const base = chartColor(modelIdx);
		const tokenType = leaf.data.tokenType;

		// Parse the base HSL and adjust lightness for token type
		const match = base.match(/hsl\((\d+)\s+([\d.]+)%\s+([\d.]+)%\)/);
		if (!match) return base;

		const h = parseInt(match[1]);
		const s = parseFloat(match[2]);
		let l = parseFloat(match[3]);

		// Vary lightness by token type for visual distinction
		switch (tokenType) {
			case 'input': l = Math.min(l + 5, 65); break;
			case 'output': l = Math.max(l - 5, 20); break;
			case 'cacheRead': l = Math.min(l + 15, 70); break;
			case 'cacheWrite': l = Math.max(l - 10, 15); break;
		}

		return `hsl(${h} ${s}% ${l}%)`;
	}

	function leafOpacity(leaf: d3.HierarchyRectangularNode<TreeNode>): number {
		const cost = leaf.value ?? 0;
		const tokens = leaf.data.tokens ?? 0;
		if (tokens === 0 || cost === 0) return 0.6;

		// Efficiency = cost per token. More efficient (lower cost/token) = slightly more transparent.
		// Less efficient (higher cost/token) = more opaque. Normalize across leaves.
		return 0.65 + 0.35 * Math.min(1, cost / (totalCost * 0.3));
	}

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let hoveredLeaf: d3.HierarchyRectangularNode<TreeNode> | null = $state(null);

	function handleLeafEnter(event: MouseEvent, leaf: d3.HierarchyRectangularNode<TreeNode>) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
		hoveredLeaf = leaf;
		tooltipVisible = true;
	}

	function handleLeafMove(event: MouseEvent) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
	}

	function handleLeafLeave() {
		tooltipVisible = false;
		hoveredLeaf = null;
	}

	// Helpers for rendering
	function rectWidth(leaf: d3.HierarchyRectangularNode<TreeNode>): number {
		return Math.max((leaf.x1 ?? 0) - (leaf.x0 ?? 0), 0);
	}

	function rectHeight(leaf: d3.HierarchyRectangularNode<TreeNode>): number {
		return Math.max((leaf.y1 ?? 0) - (leaf.y0 ?? 0), 0);
	}

	function pctOfTotal(cost: number): string {
		if (totalCost === 0) return '0%';
		return `${((cost / totalCost) * 100).toFixed(1)}%`;
	}

	// Stable ID prefix for gradients
	const uid = `treemap-${Math.random().toString(36).slice(2, 8)}`;
</script>

<div class="relative {className}" bind:this={containerEl} bind:clientWidth={containerWidth}>
	{#if isEmpty}
		<div
			class="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
			style="height: {chartHeight}px;"
		>
			No cost data available
		</div>
	{:else if treemapRoot}
		<svg
			width={Math.max(containerWidth, 200)}
			height={chartHeight}
			class="overflow-visible"
		>
			{#each leaves as leaf, i (uid + '-' + i)}
				{@const w = rectWidth(leaf)}
				{@const h = rectHeight(leaf)}
				{@const color = leafColor(leaf)}
				{@const opacity = leafOpacity(leaf)}
				{@const isHovered = hoveredLeaf === leaf}
				{@const showModelLabel = w > 60 && h > 36}
				{@const showTypeLabel = w > 40 && h > 24}
				{@const showPct = w > 50 && h > 48}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<g
					transform="translate({leaf.x0},{leaf.y0})"
					onmouseenter={(e) => handleLeafEnter(e, leaf)}
					onmousemove={handleLeafMove}
					onmouseleave={handleLeafLeave}
					class="cursor-default"
				>
					<!-- Main rectangle -->
					<rect
						width={w}
						height={h}
						rx="4"
						fill={color}
						fill-opacity={opacity}
						stroke={isHovered ? 'var(--color-foreground)' : color}
						stroke-width={isHovered ? 1.5 : 0.5}
						stroke-opacity={isHovered ? 0.8 : 0.3}
						class="transition-all duration-150"
					/>
					<!-- Subtle inner highlight on top-left edges for depth -->
					<rect
						width={w}
						height={h}
						rx="4"
						fill="none"
						stroke="white"
						stroke-width="0.5"
						stroke-opacity="0.15"
						class="pointer-events-none"
					/>

					<!-- Labels via foreignObject for clean text clipping -->
					{#if showTypeLabel}
						<foreignObject x="0" y="0" width={w} height={h} class="pointer-events-none">
							<div
								class="flex h-full flex-col justify-center overflow-hidden px-2 py-1"
								style="font-size: {w > 100 ? '11px' : '9px'};"
							>
								{#if showModelLabel}
									<span class="truncate font-semibold leading-tight text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
										{leaf.data.pricingKey}
									</span>
								{/if}
								<span class="truncate leading-tight text-white/80 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">
									{leaf.data.name}
								</span>
								{#if showPct}
									<span class="mt-0.5 truncate leading-tight text-white/70 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" style="font-size: {w > 100 ? '10px' : '8px'};">
										{pctOfTotal(leaf.value ?? 0)}
									</span>
								{/if}
							</div>
						</foreignObject>
					{/if}
				</g>
			{/each}
		</svg>

		<!-- Legend -->
		<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
			{#each activeModels.slice(0, 8) as model, i (model.pricingKey)}
				<div class="flex items-center gap-1.5 text-xs">
					<span
						class="h-2 w-2 shrink-0 rounded-full"
						style="background: {chartColor(i)}"
					></span>
					<span class="text-muted-foreground">{model.pricingKey}</span>
				</div>
			{/each}
		</div>

		<ChartTooltip visible={tooltipVisible} x={tooltipX} y={tooltipY}>
			{#if hoveredLeaf}
				{@const cost = hoveredLeaf.value ?? 0}
				{@const tokens = hoveredLeaf.data.tokens ?? 0}
				<p class="font-medium text-foreground">{hoveredLeaf.data.pricingKey}</p>
				<p class="mt-0.5 text-muted-foreground">{hoveredLeaf.data.name}</p>
				<div class="mt-1.5 space-y-0.5 border-t border-border pt-1.5">
					<div class="flex items-center justify-between gap-3">
						<span class="text-muted-foreground">Cost</span>
						<span class="tabular-nums font-medium text-foreground">{formatCurrency(cost)}</span>
					</div>
					<div class="flex items-center justify-between gap-3">
						<span class="text-muted-foreground">Share</span>
						<span class="tabular-nums text-foreground">{pctOfTotal(cost)}</span>
					</div>
					{#if tokens > 0}
						<div class="flex items-center justify-between gap-3">
							<span class="text-muted-foreground">Tokens</span>
							<span class="tabular-nums text-foreground">{formatNumber(tokens)}</span>
						</div>
					{/if}
				</div>
			{/if}
		</ChartTooltip>
	{/if}
</div>
