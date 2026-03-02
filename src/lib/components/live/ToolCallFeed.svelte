<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import type { LiveToolCall } from '$lib/data/types';

	interface Props {
		/** Recent tool calls, newest first from the tailer. */
		toolCalls: LiveToolCall[];
		/** Maximum items to display. */
		maxItems?: number;
		class?: string;
	}

	const { toolCalls, maxItems = 20, class: className = '' }: Props = $props();

	/** Displayed tool calls: newest first, capped at maxItems. */
	const displayCalls = $derived(
		[...toolCalls].reverse().slice(0, maxItems)
	);

	const isEmpty = $derived(displayCalls.length === 0);

	/** Map tool name to an icon from our Icon library. */
	function toolIcon(name: string): string {
		const lower = name.toLowerCase();
		if (lower === 'read' || lower.includes('read')) return 'eye';
		if (lower === 'edit' || lower === 'multiedit') return 'diff';
		if (lower === 'write') return 'save';
		if (lower === 'bash') return 'code';
		if (lower === 'notebookedit') return 'file-text';
		if (lower.includes('search') || lower.includes('grep') || lower.includes('glob'))
			return 'search';
		if (lower.includes('web')) return 'external-link';
		return 'wrench';
	}

	/** Status icon name for the correlated result. */
	function statusIcon(status: LiveToolCall['status']): string {
		switch (status) {
			case 'success':
				return 'check';
			case 'error':
				return 'x';
			case 'pending':
				return 'loader';
		}
	}

	/** CSS classes for status indicator. */
	function statusClass(status: LiveToolCall['status']): string {
		switch (status) {
			case 'success':
				return 'text-success';
			case 'error':
				return 'text-destructive';
			case 'pending':
				return 'text-muted-foreground animate-spin';
		}
	}

	/** Relative time display (e.g. "3s ago", "1m ago"). */
	function relativeTime(timestamp: string): string {
		const ts = new Date(timestamp).getTime();
		if (Number.isNaN(ts)) return '';
		const diffMs = Date.now() - ts;
		const seconds = Math.floor(diffMs / 1000);
		if (seconds < 60) return `${seconds}s ago`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		return `${Math.floor(minutes / 60)}h ago`;
	}
</script>

<div class="flex flex-col gap-0 {className}">
	{#if isEmpty}
		<div
			class="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-6"
		>
			<Icon name="wrench" size={20} class="mb-1.5 text-muted-foreground/40" />
			<p class="text-xs text-muted-foreground">No tool calls yet</p>
		</div>
	{:else}
		<div class="max-h-64 overflow-y-auto scrollbar-thin">
			{#each displayCalls as call (call.id)}
				<div
					class="flex items-center gap-2 border-b border-border/50 px-1 py-1.5 last:border-b-0"
				>
					<!-- Tool icon -->
					<Icon name={toolIcon(call.name)} size={14} class="shrink-0 text-muted-foreground" />

					<!-- Tool name -->
					<span class="min-w-0 flex-1 truncate text-xs font-mono text-foreground">
						{call.name}
					</span>

					<!-- Status badge -->
					<Icon
						name={statusIcon(call.status)}
						size={12}
						class="shrink-0 {statusClass(call.status)}"
					/>

					<!-- Relative timestamp -->
					<span class="shrink-0 text-[10px] tabular-nums text-muted-foreground">
						{relativeTime(call.timestamp)}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
