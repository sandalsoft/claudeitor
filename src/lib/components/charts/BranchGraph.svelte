<script lang="ts">
	import * as d3 from 'd3';
	import type { BranchNode, BranchEdge } from '$lib/data/types';
	import { chartColor } from '$lib/utils/chart-helpers';
	import ChartTooltip from './ChartTooltip.svelte';

	interface Props {
		nodes: BranchNode[];
		edges: BranchEdge[];
		class?: string;
	}

	const { nodes, edges, class: className = '' }: Props = $props();

	// ── Responsive container ──────────────────────────────────────
	let containerWidth = $state(0);
	let containerEl: HTMLDivElement | undefined = $state();
	let svgEl: SVGSVGElement | undefined = $state();

	const HEIGHT = 500;
	const width = $derived(Math.max(containerWidth, 300));

	// ── Color by repo ─────────────────────────────────────────────
	const repoNames = $derived([...new Set(nodes.map((n) => n.repo))]);
	const repoColorMap = $derived(
		Object.fromEntries(repoNames.map((name, i) => [name, chartColor(i)]))
	);

	// ── Tooltip state ─────────────────────────────────────────────
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipNode: BranchNode | null = $state(null);

	// ── D3 force simulation ───────────────────────────────────────
	type SimNode = BranchNode & d3.SimulationNodeDatum;
	type SimEdge = { source: string | SimNode; target: string | SimNode; mergeBase: string };

	let simulationRef: d3.Simulation<SimNode, SimEdge> | null = null;

	// Reactive positions for rendering
	let simNodes = $state<SimNode[]>([]);
	let simEdges = $state<SimEdge[]>([]);

	$effect(() => {
		// Stop previous simulation
		if (simulationRef) {
			simulationRef.stop();
			simulationRef = null;
		}

		if (nodes.length === 0 || width < 300) return;

		// Clone data for D3 mutation
		const nodesCopy: SimNode[] = nodes.map((n) => ({ ...n }));
		const edgesCopy: SimEdge[] = edges.map((e) => ({
			source: e.source,
			target: e.target,
			mergeBase: e.mergeBase
		}));

		const simulation = d3
			.forceSimulation<SimNode, SimEdge>(nodesCopy)
			.force(
				'link',
				d3
					.forceLink<SimNode, SimEdge>(edgesCopy)
					.id((d) => d.id)
					.distance(80)
			)
			.force('charge', d3.forceManyBody().strength(-200))
			.force('center', d3.forceCenter(width / 2, HEIGHT / 2))
			.force('collision', d3.forceCollide(20))
			.alphaDecay(0.05);

		simulation.on('tick', () => {
			// Clamp nodes within bounds
			for (const node of nodesCopy) {
				node.x = Math.max(20, Math.min(width - 20, node.x ?? width / 2));
				node.y = Math.max(20, Math.min(HEIGHT - 20, node.y ?? HEIGHT / 2));
			}
			simNodes = [...nodesCopy];
			simEdges = [...edgesCopy];
		});

		simulationRef = simulation;

		return () => {
			simulation.stop();
		};
	});

	function nodeRadius(node: SimNode): number {
		return node.isDefault ? 10 : 6;
	}

	function handleNodeEnter(event: MouseEvent, node: SimNode) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
		tooltipNode = node;
		tooltipVisible = true;
	}

	function handleNodeMove(event: MouseEvent) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
	}

	function handleNodeLeave() {
		tooltipVisible = false;
		tooltipNode = null;
	}

	function formatBranchDate(dateStr: string): string {
		if (!dateStr) return 'Unknown';
		const date = new Date(dateStr);
		const now = Date.now();
		const diff = now - date.getTime();
		if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// ── Edge coordinate helpers ───────────────────────────────────
	function edgeX1(edge: SimEdge): number {
		return typeof edge.source === 'object' ? (edge.source.x ?? 0) : 0;
	}
	function edgeY1(edge: SimEdge): number {
		return typeof edge.source === 'object' ? (edge.source.y ?? 0) : 0;
	}
	function edgeX2(edge: SimEdge): number {
		return typeof edge.target === 'object' ? (edge.target.x ?? 0) : 0;
	}
	function edgeY2(edge: SimEdge): number {
		return typeof edge.target === 'object' ? (edge.target.y ?? 0) : 0;
	}
</script>

<div class="relative {className}" bind:this={containerEl} bind:clientWidth={containerWidth}>
	{#if nodes.length === 0}
		<div
			class="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
			style="height: {HEIGHT}px;"
		>
			No branch data available
		</div>
	{:else}
		<!-- Legend -->
		<div class="mb-3 flex flex-wrap gap-3">
			{#each repoNames as repo (repo)}
				<div class="flex items-center gap-1.5">
					<span
						class="block h-2.5 w-2.5 rounded-full"
						style="background-color: {repoColorMap[repo]};"
					></span>
					<span class="text-xs text-muted-foreground">{repo}</span>
				</div>
			{/each}
		</div>

		<svg bind:this={svgEl} {width} height={HEIGHT} class="overflow-visible rounded-lg border border-border bg-card">
			<!-- Edges -->
			{#each simEdges as edge, i (`edge-${i}`)}
				<line
					x1={edgeX1(edge)}
					y1={edgeY1(edge)}
					x2={edgeX2(edge)}
					y2={edgeY2(edge)}
					stroke="var(--color-border)"
					stroke-width="1"
					stroke-opacity="0.5"
				/>
			{/each}

			<!-- Nodes -->
			{#each simNodes as node (node.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<circle
					cx={node.x ?? 0}
					cy={node.y ?? 0}
					r={nodeRadius(node)}
					fill={repoColorMap[node.repo] ?? 'var(--color-muted-foreground)'}
					stroke={node.isDefault ? 'var(--color-foreground)' : 'none'}
					stroke-width={node.isDefault ? 2 : 0}
					class="cursor-pointer transition-opacity hover:opacity-80"
					onmouseenter={(e) => handleNodeEnter(e, node)}
					onmousemove={handleNodeMove}
					onmouseleave={handleNodeLeave}
				/>
			{/each}
		</svg>

		<ChartTooltip visible={tooltipVisible} x={tooltipX} y={tooltipY}>
			{#if tooltipNode}
				<p class="font-medium text-foreground">{tooltipNode.branch}</p>
				<div class="mt-1 space-y-0.5 text-muted-foreground">
					<p>Repo: {tooltipNode.repo}</p>
					<p>HEAD: {tooltipNode.headShort}</p>
					<p>{formatBranchDate(tooltipNode.date)}</p>
					{#if tooltipNode.isDefault}
						<p class="font-medium text-primary">Default branch</p>
					{/if}
				</div>
			{/if}
		</ChartTooltip>
	{/if}
</div>
