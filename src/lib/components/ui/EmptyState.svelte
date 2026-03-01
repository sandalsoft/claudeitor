<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';

	interface Props {
		title: string;
		description: string;
		icon?: string;
		ctaLabel?: string;
		ctaHref?: string;
	}

	const {
		title,
		description,
		icon = 'info',
		ctaLabel,
		ctaHref
	}: Props = $props();
</script>

<div
	class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 py-16"
>
	<Icon name={icon} size={32} class="text-muted-foreground/40" />
	<p class="text-sm text-muted-foreground">{title}</p>
	<p class="max-w-xs text-center text-xs text-muted-foreground">
		{description}
	</p>
	{#if ctaLabel && ctaHref}
		<a
			href={ctaHref}
			class="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
		>
			{ctaLabel}
			<Icon name="arrow-right" size={12} />
		</a>
	{/if}
</div>
