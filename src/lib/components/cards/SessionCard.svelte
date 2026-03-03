<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import { subscribeMinuteTick, getMinuteTick } from '$lib/stores/minute-tick.svelte';

	interface Props {
		sessionId: string;
		description: string;
		project?: string;
		timestamp: number;
		durationMs?: number;
		processingMs?: number;
		class?: string;
	}

	const {
		sessionId,
		description,
		project,
		timestamp,
		durationMs = 0,
		processingMs = 0,
		class: className = ''
	}: Props = $props();

	function formatRelativeTime(ts: number): string {
		const now = Date.now();
		const diff = now - ts;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);
		const weeks = Math.floor(days / 7);

		if (seconds < 60) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		if (weeks < 4) return `${weeks}w ago`;
		return new Date(ts).toLocaleDateString();
	}

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

	function extractRepoName(projectPath: string): string {
		const parts = projectPath.replace(/\/$/, '').split('/');
		return parts[parts.length - 1] || projectPath;
	}

	// Subscribe to shared minute tick (reference-counted, single interval for all cards)
	$effect(() => {
		return subscribeMinuteTick();
	});

	// Use shared tick in derived to trigger recalculation
	const timeAgo = $derived.by(() => {
		void getMinuteTick();
		return formatRelativeTime(timestamp);
	});
	const repoName = $derived(project ? extractRepoName(project) : undefined);
</script>

<a
	href="/sessions/{sessionId}"
	class="group flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-colors hover:border-border/80 hover:bg-accent/50 {className}"
>
	<p class="line-clamp-2 text-sm font-medium text-foreground group-hover:text-foreground">
		{description}
	</p>

	<div class="flex items-center gap-3 text-xs text-muted-foreground">
		{#if repoName}
			<span class="flex items-center gap-1 truncate">
				<Icon name="folder" size={12} class="shrink-0" />
				<span class="truncate">{repoName}</span>
			</span>
		{/if}
		<span class="flex items-center gap-1">
			<Icon name="clock" size={12} class="shrink-0" />
			<span>{timeAgo}</span>
		</span>
		{#if durationMs > 0}
			<span class="flex items-center gap-1 tabular-nums" title="Wall clock / active processing">
				{formatDuration(durationMs)}
				<span class="text-muted-foreground/60">({formatDuration(processingMs)} active)</span>
			</span>
		{/if}
	</div>
</a>
