<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/layout/Icon.svelte';

	interface Props {
		title: string;
		icon?: string;
		count?: number | string;
		href?: string;
		class?: string;
		children?: Snippet;
	}

	const {
		title,
		icon,
		count,
		href,
		class: className = '',
		children
	}: Props = $props();
</script>

{#snippet cardContent()}
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2 min-w-0">
			{#if icon}
				<Icon name={icon} size={16} class="shrink-0 text-muted-foreground" />
			{/if}
			<span class="truncate text-sm font-medium text-foreground">{title}</span>
		</div>
		<div class="flex items-center gap-2 shrink-0">
			{#if count !== undefined}
				<span class="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
					{count}
				</span>
			{/if}
			{#if href}
				<Icon name="arrow-right" size={14} class="text-muted-foreground/60" />
			{/if}
		</div>
	</div>
	{#if children}
		<div class="mt-2">
			{@render children()}
		</div>
	{/if}
{/snippet}

{#if href}
	<a
		{href}
		class="block rounded-xl border border-border bg-card p-3 transition-colors hover:border-border/80 hover:bg-accent/50 {className}"
	>
		{@render cardContent()}
	</a>
{:else}
	<div class="rounded-xl border border-border bg-card p-3 {className}">
		{@render cardContent()}
	</div>
{/if}
