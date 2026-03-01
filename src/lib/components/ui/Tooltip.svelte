<script lang="ts">
	import type { Snippet } from 'svelte';

	type Position = 'top' | 'bottom' | 'left' | 'right';

	interface Props {
		text: string;
		position?: Position;
		class?: string;
		children: Snippet;
	}

	const { text, position = 'top', class: className = '', children }: Props = $props();

	let visible = $state(false);

	// Unique ID for aria-describedby association
	const tooltipId = `tooltip-${crypto.randomUUID().slice(0, 8)}`;

	const positionClasses: Record<Position, string> = {
		top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
		bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
		left: 'right-full top-1/2 -translate-y-1/2 mr-2',
		right: 'left-full top-1/2 -translate-y-1/2 ml-2'
	};

	const arrowClasses: Record<Position, string> = {
		top: 'top-full left-1/2 -translate-x-1/2 border-t-foreground border-x-transparent border-b-transparent',
		bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-foreground border-x-transparent border-t-transparent',
		left: 'left-full top-1/2 -translate-y-1/2 border-l-foreground border-y-transparent border-r-transparent',
		right: 'right-full top-1/2 -translate-y-1/2 border-r-foreground border-y-transparent border-l-transparent'
	};
</script>

<div
	class="relative inline-flex {className}"
	role="group"
	aria-describedby={visible && text ? tooltipId : undefined}
	onmouseenter={() => (visible = true)}
	onmouseleave={() => (visible = false)}
	onfocusin={() => (visible = true)}
	onfocusout={() => (visible = false)}
>
	{@render children()}

	{#if visible && text}
		<div
			id={tooltipId}
			class="pointer-events-none absolute z-50 {positionClasses[position]}"
			role="tooltip"
		>
			<div
				class="whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-md"
			>
				{text}
			</div>
			<div
				class="absolute h-0 w-0 border-4 {arrowClasses[position]}"
			></div>
		</div>
	{/if}
</div>
