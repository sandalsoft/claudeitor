<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// Track which skills are expanded
	let expanded = $state<Set<string>>(new Set());

	function toggleExpand(name: string) {
		const next = new Set(expanded);
		if (next.has(name)) {
			next.delete(name);
		} else {
			next.add(name);
		}
		expanded = next;
	}

	const invocableCount = $derived(
		data.skills.filter((s) => !s.disableModelInvocation).length
	);
	const symlinkCount = $derived(data.skills.filter((s) => s.isSymlink).length);
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Skills</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Skill definitions from ~/.claude/skills/ that extend Claude's capabilities.
		</p>
	</div>

	{#if data.skills.length === 0}
		<!-- Empty state -->
		<div
			class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 py-16"
		>
			<Icon name="sparkles" size={32} class="text-muted-foreground/40" />
			<p class="text-sm text-muted-foreground">No skills found.</p>
			<p class="text-xs text-muted-foreground">
				Create skill directories in ~/.claude/skills/ with a SKILL.md file.
			</p>
		</div>
	{:else}
		<!-- Summary stats -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
			<StatCard title="Total Skills" value={data.skills.length} trend="neutral" />
			<StatCard
				title="Auto-invocable"
				value={invocableCount}
				trend="neutral"
				subtitle="Claude can use automatically"
			/>
			<StatCard
				title="Symlinked"
				value={symlinkCount}
				trend="neutral"
				subtitle="Linked from other locations"
			/>
		</div>

		<!-- Skills list -->
		<div class="space-y-2">
			{#each data.skills as skill (skill.name)}
				<div class="rounded-xl border border-border bg-card transition-colors hover:border-border/80">
					<!-- Skill header -->
					<button
						onclick={() => toggleExpand(skill.name)}
						class="flex w-full items-center gap-4 px-4 py-3 text-left"
					>
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<Icon name="sparkles" size={14} class="text-primary" />
						</div>

						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">{skill.name}</span>
								{#if skill.isSymlink}
									<span
										class="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400"
									>
										symlink
									</span>
								{/if}
								{#if skill.disableModelInvocation}
									<span
										class="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
									>
										manual only
									</span>
								{/if}
							</div>
							{#if skill.description}
								<p class="mt-0.5 truncate text-xs text-muted-foreground">
									{skill.description}
								</p>
							{/if}
						</div>

						<!-- File count -->
						<div class="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
							<Icon name="file-text" size={12} />
							{skill.fileCount} file{skill.fileCount === 1 ? '' : 's'}
						</div>

						<!-- Expand chevron -->
						<Icon
							name={expanded.has(skill.name) ? 'chevron-up' : 'chevron-down'}
							size={14}
							class="shrink-0 text-muted-foreground"
						/>
					</button>

					<!-- Expanded content -->
					{#if expanded.has(skill.name) && skill.content}
						<div class="border-t border-border px-4 py-3">
							<pre
								class="max-h-96 overflow-auto rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-foreground">{skill.content}</pre>
						</div>
					{:else if expanded.has(skill.name) && !skill.content}
						<div class="border-t border-border px-4 py-3">
							<p class="text-xs italic text-muted-foreground">
								No SKILL.md file found in this skill directory.
							</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
