<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import ReplayTimeline from './ReplayTimeline.svelte';
	import type { SessionMessage } from '$lib/server/claude/session-detail';

	interface Props {
		messages: SessionMessage[];
		startTime: string;
		endTime: string;
	}

	const { messages, startTime, endTime }: Props = $props();

	// Position starts at the end so all messages are visible by default
	let position = $state(0);
	$effect(() => {
		position = messages.length;
	});

	const visibleMessages = $derived(messages.slice(0, position));

	function formatTime(isoStr: string): string {
		if (!isoStr) return '';
		return new Date(isoStr).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	/**
	 * Truncate long text for display, with expand capability on click.
	 */
	function truncateText(text: string, maxLen = 800): { text: string; truncated: boolean } {
		if (text.length <= maxLen) return { text, truncated: false };
		return { text: text.slice(0, maxLen), truncated: true };
	}

	let expandedMessages = $state(new Set<number>());

	function toggleExpand(idx: number) {
		const next = new Set(expandedMessages);
		if (next.has(idx)) {
			next.delete(idx);
		} else {
			next.add(idx);
		}
		expandedMessages = next;
	}
</script>

<div class="space-y-4">
	<!-- Timeline control -->
	<ReplayTimeline
		totalMessages={messages.length}
		{position}
		onchange={(p) => (position = p)}
		{startTime}
		{endTime}
	/>

	<!-- Messages -->
	<div class="space-y-3">
		{#if visibleMessages.length === 0}
			<div
				class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12"
			>
				<Icon name="play" size={32} class="mb-2 text-muted-foreground/40" />
				<p class="text-sm text-muted-foreground">
					Move the timeline slider to reveal messages
				</p>
			</div>
		{:else}
			{#each visibleMessages as msg, idx (idx)}
				{@const isUser = msg.role === 'user'}
				{@const isExpanded = expandedMessages.has(idx)}
				{@const preview = truncateText(msg.text)}
				<div
					class="rounded-lg border p-4 {isUser
						? 'border-border bg-muted/30'
						: 'border-border bg-card'}"
				>
					<!-- Message header -->
					<div class="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
						<Icon name={isUser ? 'user' : 'bot'} size={14} class="shrink-0" />
						<span class="font-medium {isUser ? 'text-foreground' : 'text-foreground/80'}">
							{isUser ? 'User' : 'Assistant'}
						</span>
						{#if msg.timestamp}
							<span>{formatTime(msg.timestamp)}</span>
						{/if}
						{#if msg.model}
							<span
								class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
							>
								{msg.model.replace(/-\d{8}$/, '')}
							</span>
						{/if}
						{#if msg.tokens}
							<span class="ml-auto tabular-nums">
								{msg.tokens.input.toLocaleString()} in / {msg.tokens.output.toLocaleString()} out
							</span>
						{/if}
					</div>

					<!-- Message text -->
					{#if msg.text}
						<div class="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
							{isExpanded || !preview.truncated ? msg.text : preview.text}
							{#if preview.truncated && !isExpanded}
								<span class="text-muted-foreground">...</span>
							{/if}
						</div>
						{#if preview.truncated}
							<button
								onclick={() => toggleExpand(idx)}
								class="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
							>
								{isExpanded ? 'Show less' : 'Show more'}
							</button>
						{/if}
					{/if}

					<!-- Tool calls -->
					{#if msg.toolCalls && msg.toolCalls.length > 0}
						<div class="mt-3 space-y-2">
							{#each msg.toolCalls as tool}
								<div class="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs">
									<div class="flex items-center gap-2 font-medium text-foreground/70">
										<Icon name="code" size={12} class="shrink-0" />
										<span>{tool.name}</span>
										{#if tool.filePath}
											<span class="truncate font-mono text-muted-foreground">
												{tool.filePath.split('/').slice(-2).join('/')}
											</span>
										{/if}
									</div>
									{#if tool.diff !== undefined}
										{#if tool.diff}
											<pre
												class="mt-1.5 max-h-48 overflow-auto rounded bg-background p-2 font-mono text-[11px] leading-tight"
											>{tool.diff}</pre>
										{:else}
											<p class="mt-1 text-muted-foreground">
												File change detected
											</p>
										{/if}
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
