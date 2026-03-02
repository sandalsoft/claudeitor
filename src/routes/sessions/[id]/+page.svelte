<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import SessionDetail from '$lib/components/sessions/SessionDetail.svelte';
	import SessionReplay from '$lib/components/sessions/SessionReplay.svelte';
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';

	const { data, form }: { data: PageData; form: ActionData } = $props();

	const detail = $derived(data.detail);
	const metadata = $derived(detail.metadata);
	const messages = $derived(detail.messages);

	// AI summary: prefer form action result, then cached, then null
	const summary = $derived.by(() => {
		if (form?.success && form?.summary) return form.summary;
		return data.cachedSummary;
	});

	let summaryLoading = $state(false);
</script>

<div class="space-y-6">
	<!-- Header with back link -->
	<div class="flex items-start gap-4">
		<a
			href="/sessions"
			class="mt-1 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
			title="Back to sessions"
		>
			<Icon name="chevron-left" size={20} />
		</a>

		<div class="min-w-0 flex-1">
			<h1 class="text-2xl font-bold text-foreground">Session Detail</h1>
			<p class="mt-0.5 truncate text-sm text-muted-foreground font-mono">
				{metadata.sessionId}
			</p>
		</div>
	</div>

	<!-- Metadata cards -->
	<SessionDetail {metadata} />

	<!-- AI Summary -->
	<div class="rounded-xl border border-border bg-card p-4">
		<div class="flex items-center justify-between">
			<h2 class="flex items-center gap-2 text-sm font-medium text-foreground">
				<Icon name="sparkles" size={16} />
				AI Summary
			</h2>
			{#if data.hasApiKey && !summary}
				<form
					method="POST"
					action="?/summarize"
					use:enhance={() => {
						summaryLoading = true;
						return async ({ update }) => {
							summaryLoading = false;
							await update();
						};
					}}
				>
					<button
						type="submit"
						disabled={summaryLoading}
						class="rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
					>
						{#if summaryLoading}
							<span class="flex items-center gap-1.5">
								<Icon name="loader" size={12} class="animate-spin" />
								Generating...
							</span>
						{:else}
							Generate Summary
						{/if}
					</button>
				</form>
			{/if}
		</div>

		{#if summary}
			<p class="mt-3 text-sm leading-relaxed text-foreground">
				{summary.summary}
			</p>
			<p class="mt-2 text-xs text-muted-foreground">
				Generated {new Date(summary.generatedAt).toLocaleDateString()} via {summary.model.replace(/-\d{8}$/, '')}
			</p>
		{:else if form && !form.success}
			<div class="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
				{form.error}
			</div>
		{:else if !data.hasApiKey}
			<p class="mt-3 text-sm text-muted-foreground">
				Configure API key in <a href="/settings" class="underline underline-offset-2 hover:text-foreground">Settings</a> for AI summaries.
			</p>
		{:else}
			<p class="mt-3 text-sm text-muted-foreground">
				Click "Generate Summary" to create an AI-powered summary of this session.
			</p>
		{/if}
	</div>

	<!-- Session Replay -->
	<div>
		<h2 class="mb-3 text-sm font-medium text-foreground">Session Replay</h2>
		{#if messages.length === 0}
			<div
				class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12"
			>
				<Icon name="message-square" size={32} class="mb-2 text-muted-foreground/40" />
				<p class="text-sm text-muted-foreground">
					No conversation messages found in this session
				</p>
			</div>
		{:else}
			<SessionReplay
				{messages}
				startTime={metadata.startTime}
				endTime={metadata.endTime}
			/>
		{/if}
	</div>

	<!-- Files modified -->
	{#if metadata.filesModified.length > 0}
		<div>
			<h2 class="mb-3 text-sm font-medium text-foreground">Files Touched</h2>
			<div class="rounded-xl border border-border bg-card p-4">
				<div class="space-y-1">
					{#each metadata.filesModified.slice(0, 30) as filePath}
						<div class="flex items-center gap-2 text-xs text-muted-foreground">
							<Icon name="file-text" size={12} class="shrink-0" />
							<span class="truncate font-mono">{filePath}</span>
						</div>
					{/each}
					{#if metadata.filesModified.length > 30}
						<p class="pt-1 text-xs text-muted-foreground">
							...and {metadata.filesModified.length - 30} more
						</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
