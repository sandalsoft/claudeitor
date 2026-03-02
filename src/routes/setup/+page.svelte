<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	function statusColor(status: string): string {
		switch (status) {
			case 'ok':
				return 'bg-emerald-500';
			case 'warn':
				return 'bg-amber-500';
			case 'error':
				return 'bg-red-500';
			default:
				return 'bg-muted-foreground/40';
		}
	}

	function statusIcon(status: string): string {
		switch (status) {
			case 'ok':
				return 'check';
			case 'warn':
				return 'alert-triangle';
			case 'error':
				return 'x';
			default:
				return 'info';
		}
	}

	function statusTextColor(status: string): string {
		switch (status) {
			case 'ok':
				return 'text-emerald-600 dark:text-emerald-400';
			case 'warn':
				return 'text-amber-600 dark:text-amber-400';
			case 'error':
				return 'text-red-600 dark:text-red-400';
			default:
				return 'text-muted-foreground';
		}
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Setup</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Configuration health check for your Claude Code environment.
		</p>
	</div>

	<!-- Summary stat cards -->
	<div class="grid grid-cols-3 gap-3">
		<StatCard title="Passing" value={data.okCount} trend="neutral" />
		<StatCard title="Warnings" value={data.warnCount} trend="neutral" />
		<StatCard title="Errors" value={data.errorCount} trend="neutral" />
	</div>

	<!-- Checklist -->
	<div class="space-y-2">
		{#each data.checks as item (item.label)}
			<div class="rounded-xl border border-border bg-card transition-colors hover:border-border/80">
				<div class="flex items-center gap-4 px-4 py-3">
					<!-- Status indicator -->
					<div class="shrink-0">
						<span class="block h-2.5 w-2.5 rounded-full {statusColor(item.status)}"></span>
					</div>

					<!-- Check info -->
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-foreground">{item.label}</span>
						</div>
						<p class="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
					</div>

					<!-- Status icon -->
					<div class="shrink-0 {statusTextColor(item.status)}">
						<Icon name={statusIcon(item.status)} size={16} />
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
