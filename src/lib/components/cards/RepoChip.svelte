<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';

	type ActivityLevel = 'high' | 'medium' | 'low' | 'none';

	interface Props {
		name: string;
		href?: string;
		activity?: ActivityLevel;
		class?: string;
	}

	const {
		name,
		href,
		activity = 'none',
		class: className = ''
	}: Props = $props();

	const activityColors: Record<ActivityLevel, string> = {
		high: 'bg-success',
		medium: 'bg-warning',
		low: 'bg-muted-foreground/50',
		none: 'bg-muted-foreground/20'
	};

	const activityLabels: Record<ActivityLevel, string> = {
		high: 'High activity',
		medium: 'Medium activity',
		low: 'Low activity',
		none: 'No recent activity'
	};
</script>

{#snippet chipContent()}
	<span
		class="h-1.5 w-1.5 shrink-0 rounded-full {activityColors[activity]}"
		title={activityLabels[activity]}
	></span>
	<Icon name="folder" size={12} class="shrink-0 text-muted-foreground" />
	<span class="truncate">{name}</span>
{/snippet}

{#if href}
	<a
		{href}
		class="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent/50 {className}"
		title="{name} - {activityLabels[activity]}"
	>
		{@render chipContent()}
	</a>
{:else}
	<span
		class="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground {className}"
		title="{name} - {activityLabels[activity]}"
	>
		{@render chipContent()}
	</span>
{/if}
