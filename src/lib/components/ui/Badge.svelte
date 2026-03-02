<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

	interface Props {
		variant?: Variant;
		class?: string;
		children: Snippet;
	}

	const { variant = 'default', class: className = '', children }: Props = $props();

	const variantClasses: Record<Variant, string> = {
		default: 'bg-primary text-primary-foreground',
		secondary: 'bg-secondary text-secondary-foreground',
		success: 'bg-success/15 text-success dark:bg-success/20',
		warning: 'bg-warning/15 text-warning dark:bg-warning/20',
		destructive: 'bg-destructive/15 text-destructive dark:bg-destructive/20',
		outline: 'border border-border text-foreground bg-transparent'
	};
</script>

<span
	class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors {variantClasses[variant]} {className}"
>
	{@render children()}
</span>
