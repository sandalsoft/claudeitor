<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// Track which files are expanded (first file starts expanded)
	let expanded = $state<Set<string>>(new Set());
	let initialized = false;

	$effect(() => {
		if (!initialized && data.files.length > 0) {
			expanded = new Set([data.files[0].path]);
			initialized = true;
		}
	});

	function toggleExpand(path: string) {
		const next = new Set(expanded);
		if (next.has(path)) {
			next.delete(path);
		} else {
			next.add(path);
		}
		expanded = next;
	}

	const totalLines = $derived(data.files.reduce((sum, f) => sum + f.lineCount, 0));

	function scopeColor(scope: string): string {
		switch (scope) {
			case 'global':
				return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
			case 'project':
				return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
			case 'child':
				return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
			default:
				return 'bg-muted text-muted-foreground';
		}
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Memory</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Read-only view of CLAUDE.md memory files that provide persistent context.
		</p>
	</div>

	{#if data.files.length === 0}
		<EmptyState
			icon="brain"
			title="No CLAUDE.md files found."
			description="Create a CLAUDE.md in ~/.claude/ or your project root to provide Claude with persistent context."
		/>
	{:else}
		<!-- Summary stats -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
			<StatCard title="Memory Files" value={data.files.length} trend="neutral" />
			<StatCard title="Total Lines" value={totalLines} trend="neutral" />
			<StatCard
				title="Scopes"
				value={new Set(data.files.map((f) => f.scope)).size}
				trend="neutral"
				subtitle="global, project, child"
			/>
		</div>

		<!-- File list -->
		<div class="space-y-2">
			{#each data.files as file (file.path)}
				<div class="rounded-xl border border-border bg-card transition-colors hover:border-border/80">
					<!-- File header -->
					<button
						onclick={() => toggleExpand(file.path)}
						class="flex w-full items-center gap-4 px-4 py-3 text-left"
					>
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<Icon name="brain" size={14} class="text-primary" />
						</div>

						<div class="min-w-0 flex-1">
							<span class="text-sm font-medium text-foreground">{file.label}</span>
							<div class="mt-0.5 flex items-center gap-2">
								<span class="rounded px-1.5 py-0.5 text-[10px] font-medium {scopeColor(file.scope)}">
									{file.scope}
								</span>
								<span class="text-xs text-muted-foreground">
									{file.lineCount} line{file.lineCount === 1 ? '' : 's'}
								</span>
							</div>
						</div>

						<!-- Expand chevron -->
						<Icon
							name={expanded.has(file.path) ? 'chevron-up' : 'chevron-down'}
							size={14}
							class="shrink-0 text-muted-foreground"
						/>
					</button>

					<!-- Expanded content -->
					{#if expanded.has(file.path)}
						<div class="border-t border-border px-4 py-3">
							<!-- Read-only indicator -->
							<div class="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
								<Icon name="info" size={10} />
								Read-only view
							</div>
							<pre
								class="max-h-[32rem] overflow-auto rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-foreground">{file.content}</pre>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
