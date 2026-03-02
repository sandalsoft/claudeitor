<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let expandedSessions = $state(new Set<string>());

	function toggleSession(sessionId: string) {
		const next = new Set(expandedSessions);
		if (next.has(sessionId)) {
			next.delete(sessionId);
		} else {
			next.add(sessionId);
		}
		expandedSessions = next;
	}

	function formatTimestamp(ts: number): string {
		const date = new Date(ts);
		const now = Date.now();
		const diff = now - ts;

		if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function truncateDisplay(text: string, maxLen = 100): string {
		if (text.length <= maxLen) return text;
		return text.slice(0, maxLen) + '...';
	}

	function shortPath(filePath: string): string {
		const parts = filePath.split('/');
		if (parts.length <= 3) return filePath;
		return '.../' + parts.slice(-3).join('/');
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Session Diffs</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			File mutations from recent Claude Code sessions. Expand a session to see individual changes.
		</p>
	</div>

	{#if data.diffs.length === 0}
		<EmptyState
			icon="diff"
			title="No session diffs found."
			description="Claude Code session history is empty or sessions have no file mutations."
			ctaLabel="View Sessions"
			ctaHref="/sessions"
		/>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
			<StatCard title="Sessions" value={data.totalSessions} trend="neutral" />
			<StatCard title="Total Mutations" value={data.totalMutations} trend="neutral" />
			<StatCard title="Unique Files" value={data.uniqueFileCount} trend="neutral" />
		</div>

		<!-- Session list -->
		<div class="space-y-2">
			{#each data.diffs as session (session.sessionId)}
				{@const isExpanded = expandedSessions.has(session.sessionId ?? '')}
				<div class="rounded-xl border border-border bg-card">
					<!-- Session header -->
					<button
						type="button"
						class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/30"
						onclick={() => toggleSession(session.sessionId ?? '')}
					>
						<Icon
							name={isExpanded ? 'chevron-down' : 'chevron-right'}
							size={14}
							class="shrink-0 text-muted-foreground"
						/>
						<div class="min-w-0 flex-1">
							<span class="text-sm font-medium text-foreground">
								{truncateDisplay(session.display)}
							</span>
							<div class="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
								<span>{formatTimestamp(session.timestamp)}</span>
								<span>{session.mutations.length} mutation{session.mutations.length === 1 ? '' : 's'}</span>
								{#if session.project}
									<span class="truncate" title={session.project}>
										{session.project.split('/').pop()}
									</span>
								{/if}
							</div>
						</div>
					</button>

					<!-- Expanded mutations -->
					{#if isExpanded}
						<div class="border-t border-border">
							{#if session.mutations.length === 0}
								<p class="px-4 py-3 text-xs text-muted-foreground">
									No file mutations in this session.
								</p>
							{:else}
								{#each session.mutations as mutation, idx (idx)}
									<div class="border-b border-border/50 px-4 py-2 last:border-b-0">
										<div class="flex items-center gap-2">
											<Icon name="file-text" size={12} class="shrink-0 text-muted-foreground" />
											<span
												class="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
												title={mutation.filePath}
											>
												{shortPath(mutation.filePath)}
											</span>
											<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
												{mutation.tool}
											</span>
										</div>
										{#if mutation.diff}
											<pre
												class="mt-1.5 max-h-48 overflow-auto rounded bg-muted/50 p-2 font-mono text-xs leading-relaxed"
											>{#each mutation.diff.split('\n') as line}{#if line.startsWith('+ ')}<span class="text-emerald-600 dark:text-emerald-400">{line}
</span>{:else if line.startsWith('- ')}<span class="text-red-500 dark:text-red-400">{line}
</span>{:else}{line}
{/if}{/each}</pre>
										{:else}
											<p class="mt-1 text-xs text-muted-foreground/70">
												Full file write (no inline diff available)
											</p>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
