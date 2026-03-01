<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// Track which triggers are expanded (active triggers start expanded)
	let expanded = $state<Set<string>>(new Set());
	let initialized = false;

	$effect(() => {
		if (!initialized && data.groups.length > 0) {
			expanded = new Set(data.groups.filter((g) => g.hookCount > 0).map((g) => g.trigger));
			initialized = true;
		}
	});

	function toggleExpand(trigger: string) {
		const next = new Set(expanded);
		if (next.has(trigger)) {
			next.delete(trigger);
		} else {
			next.add(trigger);
		}
		expanded = next;
	}

	function triggerIcon(trigger: string): string {
		switch (trigger) {
			case 'PreToolUse':
			case 'PostToolUse':
				return 'wrench';
			case 'Stop':
			case 'SubagentStop':
				return 'pause';
			case 'SessionStart':
			case 'SessionEnd':
				return 'activity';
			case 'UserPromptSubmit':
				return 'message-square';
			case 'Notification':
				return 'info';
			default:
				return 'webhook';
		}
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Hooks</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Hook configurations from settings.json that run scripts at specific workflow points.
		</p>
	</div>

	{#if data.groups.length === 0}
		<!-- Empty state -->
		<div
			class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 py-16"
		>
			<Icon name="webhook" size={32} class="text-muted-foreground/40" />
			<p class="text-sm text-muted-foreground">No hooks configured.</p>
			<p class="text-xs text-muted-foreground">
				Add hooks to settings.json to run scripts at specific Claude Code workflow points.
			</p>
		</div>
	{:else}
		<!-- Summary stats -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
			<StatCard title="Trigger Types" value={data.groups.length} trend="neutral" />
			<StatCard
				title="Active Triggers"
				value={data.activeTriggers}
				trend="neutral"
				subtitle="Have at least one hook"
			/>
			<StatCard title="Total Hooks" value={data.totalHooks} trend="neutral" />
		</div>

		<!-- Hook groups by trigger -->
		<div class="space-y-2">
			{#each data.groups as group (group.trigger)}
				<div class="rounded-xl border border-border bg-card transition-colors hover:border-border/80">
					<!-- Trigger header -->
					<button
						onclick={() => toggleExpand(group.trigger)}
						class="flex w-full items-center gap-4 px-4 py-3 text-left"
					>
						<div
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
								{group.hookCount > 0 ? 'bg-primary/10' : 'bg-muted'}"
						>
							<Icon
								name={triggerIcon(group.trigger)}
								size={14}
								class={group.hookCount > 0 ? 'text-primary' : 'text-muted-foreground/60'}
							/>
						</div>

						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">{group.trigger}</span>
								{#if group.hookCount > 0}
									<span
										class="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
									>
										{group.hookCount} hook{group.hookCount === 1 ? '' : 's'}
									</span>
								{:else}
									<span
										class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
									>
										empty
									</span>
								{/if}
							</div>
							{#if group.matcherCount > 0 && group.hookCount > 0}
								<p class="mt-0.5 text-xs text-muted-foreground">
									{group.matcherCount} matcher{group.matcherCount === 1 ? '' : 's'} configured
								</p>
							{/if}
						</div>

						<!-- Expand chevron -->
						<Icon
							name={expanded.has(group.trigger) ? 'chevron-up' : 'chevron-down'}
							size={14}
							class="shrink-0 text-muted-foreground"
						/>
					</button>

					<!-- Expanded content -->
					{#if expanded.has(group.trigger)}
						<div class="border-t border-border px-4 py-3">
							{#if group.hookCount === 0}
								<p class="text-xs italic text-muted-foreground">
									No hooks configured for this trigger.
								</p>
							{:else}
								<div class="space-y-3">
									{#each group.matchers as m (m.matcher)}
										{#if m.hooks.length > 0}
											<div>
												<!-- Matcher label -->
												<div class="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
													<span class="font-medium">Matcher:</span>
													<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
														{m.matcher}
													</code>
												</div>

												<!-- Hook commands -->
												{#each m.hooks as hook (hook.command)}
													<div
														class="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2"
													>
														<span
															class="mt-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
														>
															{hook.type}
														</span>
														<code
															class="min-w-0 flex-1 break-all font-mono text-xs text-foreground"
														>
															{hook.command}
														</code>
													</div>
												{/each}
											</div>
										{/if}
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
