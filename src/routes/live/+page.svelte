<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/layout/Icon.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// Polling-based refresh (NOT SSE -- per spec).
	// Uses recursive setTimeout so the next poll only starts after the
	// previous invalidation completes, preventing overlap on slow scans.
	$effect(() => {
		let cancelled = false;

		async function poll() {
			if (cancelled) return;
			await invalidateAll();
			if (!cancelled) {
				setTimeout(poll, data.refreshInterval ?? 30_000);
			}
		}

		const timer = setTimeout(poll, data.refreshInterval ?? 30_000);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	});

	function formatTimestamp(ts: number): string {
		const date = new Date(ts);
		const now = Date.now();
		const diff = now - ts;

		if (diff < 60_000) return 'Just now';
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function eventIcon(type: string): string {
		return type === 'commit' ? 'git-branch' : 'messages-square';
	}

	function eventColor(type: string): string {
		return type === 'commit'
			? 'text-emerald-500 dark:text-emerald-400'
			: 'text-blue-500 dark:text-blue-400';
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Live</h1>
			<p class="mt-0.5 text-sm text-muted-foreground">
				Active Claude sessions and recent activity feed.
			</p>
		</div>
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			<span class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
			Polling every {Math.round((data.refreshInterval ?? 30000) / 1000)}s
		</div>
	</div>

	<!-- Active Sessions -->
	<div class="rounded-xl border border-border bg-card">
		<div class="border-b border-border px-4 py-3">
			<div class="flex items-center gap-2">
				<Icon name="activity" size={16} class="text-foreground" />
				<h2 class="text-sm font-medium text-foreground">Active Sessions</h2>
				<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
					{data.activeSessions.length}
				</span>
			</div>
		</div>

		{#if data.activeSessions.length === 0}
			<div class="flex flex-col items-center gap-3 px-4 py-12">
				<Icon name="monitor" size={32} class="text-muted-foreground/40" />
				<p class="text-sm text-muted-foreground">No active Claude sessions.</p>
				<p class="text-xs text-muted-foreground">
					Start a Claude Code session in your terminal to see it appear here.
				</p>
			</div>
		{:else}
			<div class="divide-y divide-border">
				{#each data.activeSessions as session (session.pid)}
					<div class="flex items-center gap-4 px-4 py-3">
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
							<span class="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500"></span>
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">
									PID {session.pid}
								</span>
								{#if session.project}
									<span class="truncate rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
										{session.project.split('/').pop()}
									</span>
								{/if}
							</div>
							<p class="mt-0.5 truncate text-xs text-muted-foreground">
								{session.command}
							</p>
						</div>
						<div class="shrink-0 text-right text-xs text-muted-foreground">
							<div>CPU {session.cpuPercent.toFixed(1)}%</div>
							<div>MEM {session.memPercent.toFixed(1)}%</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Activity Feed -->
	<div class="rounded-xl border border-border bg-card">
		<div class="border-b border-border px-4 py-3">
			<div class="flex items-center gap-2">
				<Icon name="clock" size={16} class="text-foreground" />
				<h2 class="text-sm font-medium text-foreground">Recent Activity</h2>
				<span class="text-xs text-muted-foreground">Last 24 hours</span>
			</div>
		</div>

		{#if data.events.length === 0}
			<div class="flex flex-col items-center gap-3 px-4 py-12">
				<Icon name="calendar" size={32} class="text-muted-foreground/40" />
				<p class="text-sm text-muted-foreground">No recent activity.</p>
				<p class="text-xs text-muted-foreground">
					Commits and session starts from the last 24 hours will appear here.
				</p>
			</div>
		{:else}
			<div class="divide-y divide-border/50">
				{#each data.events as event, i (event.timestamp + '-' + i)}
					<div class="flex gap-3 px-4 py-2.5">
						<div class="mt-0.5 shrink-0">
							<Icon
								name={eventIcon(event.type)}
								size={14}
								class={eventColor(event.type)}
							/>
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm text-foreground">{event.title}</p>
							<p class="text-xs text-muted-foreground">{event.detail}</p>
						</div>
						<span class="shrink-0 text-xs text-muted-foreground">
							{formatTimestamp(event.timestamp)}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
