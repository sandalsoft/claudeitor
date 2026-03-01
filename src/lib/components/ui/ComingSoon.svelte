<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';

	interface Props {
		title: string;
		description: string;
		icon?: string;
		linkHref?: string;
		linkLabel?: string;
	}

	const {
		title,
		description,
		icon = 'clock',
		linkHref,
		linkLabel = 'Learn more'
	}: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-6 py-24">
	<div
		class="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted"
	>
		<Icon name={icon} size={28} class="text-muted-foreground/60" />
	</div>

	<div class="max-w-sm text-center">
		<h2 class="text-lg font-semibold text-foreground">{title}</h2>
		<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
			{description}
		</p>
	</div>

	<div class="flex items-center gap-1.5 rounded-full bg-muted/60 px-4 py-2">
		<span class="h-1.5 w-1.5 rounded-full bg-primary/40"></span>
		<span class="text-xs font-medium text-muted-foreground">Coming Soon</span>
	</div>

	{#if linkHref}
		<a
			href={linkHref}
			class="flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-primary/80"
		>
			{linkLabel}
			<Icon name="arrow-right" size={14} />
		</a>
	{/if}
</div>
