<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Whether the tooltip is currently visible. */
		visible: boolean;
		/** Mouse X position relative to the chart container. */
		x: number;
		/** Mouse Y position relative to the chart container. */
		y: number;
		/** Tooltip content rendered via snippet. */
		children: Snippet;
	}

	const { visible, x, y, children }: Props = $props();

	// Offset from cursor to avoid covering the hovered element.
	const OFFSET_X = 12;
	const OFFSET_Y = -8;
</script>

{#if visible}
	<div
		class="pointer-events-none absolute z-50 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg"
		style="left: {x + OFFSET_X}px; top: {y + OFFSET_Y}px; transform: translateY(-100%);"
		role="tooltip"
	>
		{@render children()}
	</div>
{/if}
