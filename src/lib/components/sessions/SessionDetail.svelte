<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import type { SessionMetadata } from '$lib/server/claude/session-detail';
	import { formatNumber } from '$lib/utils/chart-helpers';

	interface Props {
		metadata: SessionMetadata;
	}

	const { metadata }: Props = $props();

	function formatDuration(ms: number): string {
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

	function formatDateTime(isoStr: string): string {
		const d = new Date(isoStr);
		return d.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function extractRepoName(path: string): string {
		const parts = path.replace(/\/$/, '').split('/');
		return parts[parts.length - 1] || path;
	}

	function shortModel(model: string): string {
		// Strip date suffix patterns like -20250929
		return model.replace(/-\d{8}$/, '');
	}

	const totalTokens = $derived(
		metadata.totalInputTokens +
			metadata.totalOutputTokens +
			metadata.totalCacheReadTokens +
			metadata.totalCacheWriteTokens
	);
</script>

<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
	<!-- Duration -->
	<div class="rounded-xl border border-border bg-card p-3">
		<p class="text-xs font-medium text-muted-foreground">Duration</p>
		<p class="mt-1 text-lg font-semibold text-foreground">
			{formatDuration(metadata.durationMs)}
		</p>
		<p class="mt-0.5 text-xs text-muted-foreground">
			{formatDateTime(metadata.startTime)}
		</p>
	</div>

	<!-- Model -->
	<div class="rounded-xl border border-border bg-card p-3">
		<p class="text-xs font-medium text-muted-foreground">Model</p>
		<p class="mt-1 truncate text-lg font-semibold text-foreground">
			{shortModel(metadata.model)}
		</p>
		{#if metadata.version}
			<p class="mt-0.5 text-xs text-muted-foreground">v{metadata.version}</p>
		{/if}
	</div>

	<!-- Tokens -->
	<div class="rounded-xl border border-border bg-card p-3">
		<p class="text-xs font-medium text-muted-foreground">Tokens</p>
		<p class="mt-1 text-lg font-semibold text-foreground">{formatNumber(totalTokens)}</p>
		<p class="mt-0.5 text-xs text-muted-foreground">
			{formatNumber(metadata.totalInputTokens)} in / {formatNumber(metadata.totalOutputTokens)} out
		</p>
	</div>

	<!-- Messages & Tools -->
	<div class="rounded-xl border border-border bg-card p-3">
		<p class="text-xs font-medium text-muted-foreground">Messages</p>
		<p class="mt-1 text-lg font-semibold text-foreground">{metadata.messageCount}</p>
		<p class="mt-0.5 text-xs text-muted-foreground">
			{metadata.toolCallCount} tool call{metadata.toolCallCount === 1 ? '' : 's'}
		</p>
	</div>
</div>

<!-- Additional metadata row -->
<div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
	{#if metadata.project}
		<span class="flex items-center gap-1">
			<Icon name="folder" size={12} class="shrink-0" />
			<span class="truncate">{extractRepoName(metadata.project)}</span>
		</span>
	{/if}
	{#if metadata.gitBranch}
		<span class="flex items-center gap-1">
			<Icon name="git-branch" size={12} class="shrink-0" />
			<span class="truncate">{metadata.gitBranch}</span>
		</span>
	{/if}
	{#if metadata.filesModified.length > 0}
		<span class="flex items-center gap-1">
			<Icon name="file-text" size={12} class="shrink-0" />
			{metadata.filesModified.length} file{metadata.filesModified.length === 1 ? '' : 's'} touched
		</span>
	{/if}
</div>
