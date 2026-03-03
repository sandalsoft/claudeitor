<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import DurationTimer from './DurationTimer.svelte';
	import TokenCounter from './TokenCounter.svelte';
	import { formatCurrency } from '$lib/utils/chart-helpers';
	import type { EnrichedActiveSession } from '$lib/data/types';

	type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

	interface Props {
		session: EnrichedActiveSession;
		class?: string;
	}

	const { session, class: className = '' }: Props = $props();

	const modelFamily = $derived(resolveModelFamily(session.displayModel));
	const badgeVariant = $derived(modelBadgeVariant(modelFamily));
	const costDisplay = $derived(formatCurrency(session.cost));
	const projectName = $derived(
		session.project ? session.project.replace(/\/$/, '').split('/').pop() ?? session.project : undefined
	);

	const fileCount = $derived(session.telemetry?.recentFiles.length ?? 0);
	const toolCallCount = $derived(session.telemetry?.recentToolCalls.length ?? 0);
	const processingMs = $derived(session.telemetry?.processingMs ?? 0);
	const processingDisplay = $derived(formatProcessingTime(processingMs));

	function resolveModelFamily(displayModel: string): string {
		const lower = displayModel.toLowerCase();
		if (lower.includes('opus')) return 'opus';
		if (lower.includes('sonnet')) return 'sonnet';
		if (lower.includes('haiku')) return 'haiku';
		return 'unknown';
	}

	function formatProcessingTime(ms: number): string {
		if (ms < 1000) return '<1s';
		const seconds = Math.floor(ms / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return `${hours}h ${remainingMinutes}m`;
	}

	function modelBadgeVariant(family: string): BadgeVariant {
		switch (family) {
			case 'opus':
				return 'default';
			case 'sonnet':
				return 'secondary';
			case 'haiku':
				return 'outline';
			default:
				return 'outline';
		}
	}
</script>

<div
	class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors {className}"
>
	<!-- Header: Model badge + project + duration -->
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center gap-2 min-w-0">
			<Badge variant={badgeVariant}>
				{session.displayModel}
			</Badge>
			{#if projectName}
				<span class="truncate text-xs text-muted-foreground">{projectName}</span>
			{/if}
		</div>
		<div class="flex items-center gap-3 shrink-0 text-muted-foreground">
			<div class="flex items-center gap-1.5">
				<Icon name="clock" size={14} />
				<DurationTimer startTime={session.startedAt} class="text-sm text-foreground" />
			</div>
			<span class="text-xs tabular-nums" title="Active processing time">
				{processingDisplay} active
			</span>
		</div>
	</div>

	<!-- Body: Token grid + cost -->
	{#if session.telemetry}
		<div class="grid grid-cols-2 gap-x-4 gap-y-2">
			<TokenCounter label="Input" value={session.telemetry.tokens.input} />
			<TokenCounter label="Output" value={session.telemetry.tokens.output} />
			<TokenCounter label="Cache Read" value={session.telemetry.tokens.cacheRead} />
			<TokenCounter label="Cache Write" value={session.telemetry.tokens.cacheWrite} />
		</div>

		<div class="flex items-center gap-1.5 text-sm font-medium text-foreground">
			<Icon name="dollar-sign" size={14} class="text-muted-foreground" />
			<span class="tabular-nums">{costDisplay}</span>
		</div>
	{:else}
		<p class="text-xs text-muted-foreground italic">Awaiting telemetry data...</p>
	{/if}

	<!-- Footer: File count + tool call count -->
	<div class="flex items-center gap-4 border-t border-border pt-2 text-xs text-muted-foreground">
		<span class="flex items-center gap-1">
			<Icon name="file-text" size={12} />
			{fileCount} {fileCount === 1 ? 'file' : 'files'}
		</span>
		<span class="flex items-center gap-1">
			<Icon name="code" size={12} />
			{toolCallCount} {toolCallCount === 1 ? 'tool call' : 'tool calls'}
		</span>
		{#if session.telemetry}
			<span class="flex items-center gap-1">
				<Icon name="messages-square" size={12} />
				{session.telemetry.messageCount} {session.telemetry.messageCount === 1 ? 'message' : 'messages'}
			</span>
		{/if}
	</div>
</div>
