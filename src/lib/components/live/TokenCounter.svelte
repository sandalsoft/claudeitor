<script lang="ts">
	import { formatNumber } from '$lib/utils/chart-helpers';

	interface Props {
		label: string;
		value: number;
		class?: string;
	}

	const { label, value, class: className = '' }: Props = $props();

	const formatted = $derived(formatNumber(value));
</script>

<div class="flex flex-col gap-0.5 {className}">
	<span class="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
	<span class="text-sm font-semibold tabular-nums text-foreground transition-all duration-300">
		{formatted}
	</span>
</div>
