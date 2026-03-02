<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { LiveFileMutation } from '$lib/data/types';

	type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

	interface Props {
		/** Recent file mutations from the tailer. */
		fileMutations: LiveFileMutation[];
		/** Maximum items to display. */
		maxItems?: number;
		class?: string;
	}

	const { fileMutations, maxItems = 15, class: className = '' }: Props = $props();

	/** Displayed file mutations: newest first, capped at maxItems. */
	const displayFiles = $derived(
		[...fileMutations].reverse().slice(0, maxItems)
	);

	const isEmpty = $derived(displayFiles.length === 0);

	/** Icon for the operation type. */
	function operationIcon(op: LiveFileMutation['operation']): string {
		switch (op) {
			case 'read':
				return 'eye';
			case 'edit':
				return 'diff';
			case 'write':
				return 'save';
			case 'notebook_edit':
				return 'file-text';
			default:
				return 'file-text';
		}
	}

	/** Badge variant for operation type. */
	function operationBadgeVariant(op: LiveFileMutation['operation']): BadgeVariant {
		switch (op) {
			case 'read':
				return 'outline';
			case 'edit':
				return 'warning';
			case 'write':
				return 'success';
			case 'notebook_edit':
				return 'secondary';
			default:
				return 'outline';
		}
	}

	/** Human-readable operation label. */
	function operationLabel(op: LiveFileMutation['operation']): string {
		switch (op) {
			case 'read':
				return 'Read';
			case 'edit':
				return 'Edit';
			case 'write':
				return 'Write';
			case 'notebook_edit':
				return 'NbEdit';
			default:
				return 'Other';
		}
	}

	/** Extract just the filename from a full path. */
	function fileName(filePath: string): string {
		const parts = filePath.split('/');
		return parts[parts.length - 1] || filePath;
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
			<Icon name="file-text" size={20} class="mb-1.5 text-muted-foreground/40" />
			<p class="text-xs text-muted-foreground">No file activity yet</p>
		</div>
	{:else}
		<div class="max-h-64 overflow-y-auto scrollbar-thin">
			{#each displayFiles as mutation (`${mutation.filePath}-${mutation.timestamp}`)}
				<div
					class="flex items-center gap-2 border-b border-border/50 px-1 py-1.5 last:border-b-0"
				>
					<!-- Operation icon -->
					<Icon
						name={operationIcon(mutation.operation)}
						size={14}
						class="shrink-0 text-muted-foreground"
					/>

					<!-- File path (truncated, showing filename prominently) -->
					<div class="min-w-0 flex-1">
						<span class="block truncate text-xs font-mono text-foreground" title={mutation.filePath}>
							{fileName(mutation.filePath)}
						</span>
					</div>

					<!-- Operation badge -->
					<Badge variant={operationBadgeVariant(mutation.operation)} class="shrink-0 text-[10px]">
						{operationLabel(mutation.operation)}
					</Badge>

					<!-- Recency indicator -->
					<span class="shrink-0 text-[10px] tabular-nums text-muted-foreground">
						{relativeTime(mutation.timestamp)}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
