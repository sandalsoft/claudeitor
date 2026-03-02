<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';
	import Icon from '$lib/components/layout/Icon.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import FlightCard from '$lib/components/live/FlightCard.svelte';
	import BurnRateChart from '$lib/components/live/BurnRateChart.svelte';
	import ToolCallFeed from '$lib/components/live/ToolCallFeed.svelte';
	import FileActivityFeed from '$lib/components/live/FileActivityFeed.svelte';
	import type { EnrichedActiveSession } from '$lib/data/types';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// ── Token history for burn rate charts ────────────────────────
	// Map<sessionId|pid, Array<{timestamp, tokensPerMinute}>>
	// Accumulates across polls; capped at 30 points per session.

	interface TokenHistoryPoint {
		timestamp: number;
		tokensPerMinute: number;
	}

	type SessionTokenState = {
		lastTokenTotal: number;
		lastTimestamp: number;
		history: TokenHistoryPoint[];
	};

	const HISTORY_WINDOW = 30;
	let tokenStateMap = $state<Map<string, SessionTokenState>>(new Map());

	// ── Selected session for expanded detail view ─────────────────
	let selectedSessionId = $state<string | null>(null);

	// ── Track previous session keys to detect appear/disappear ────
	let previousSessionKeys = $state<Set<string>>(new Set());
	let endedSessions = $state<Map<string, EnrichedActiveSession>>(new Map());

	// ── Sorted sessions: most active (total tokens) first ─────────
	const sortedSessions = $derived.by(() => {
		const sessions = [...data.activeSessions];
		sessions.sort((a, b) => {
			const aTotal = a.telemetry
				? a.telemetry.tokens.input + a.telemetry.tokens.output + a.telemetry.tokens.cacheRead + a.telemetry.tokens.cacheWrite
				: 0;
			const bTotal = b.telemetry
				? b.telemetry.tokens.input + b.telemetry.tokens.output + b.telemetry.tokens.cacheRead + b.telemetry.tokens.cacheWrite
				: 0;
			return bTotal - aTotal;
		});
		return sessions;
	});

	function sessionKey(s: EnrichedActiveSession): string {
		return s.sessionId ?? `pid-${s.pid}`;
	}

	// ── Per-poll: update token history, detect lifecycle changes ───
	$effect(() => {
		const now = Date.now();
		const currentKeys = new Set(sortedSessions.map(sessionKey));

		// Detect ended sessions (were in previous, not in current)
		for (const key of previousSessionKeys) {
			if (!currentKeys.has(key)) {
				// Find the last known state
				const existing = data.activeSessions.find((s) => sessionKey(s) === key);
				if (existing) {
					endedSessions.set(key, existing);
					// Auto-remove after 5 seconds
					setTimeout(() => {
						endedSessions.delete(key);
					}, 5000);
				}
			}
		}

		previousSessionKeys = currentKeys;

		// Update token history for each active session
		for (const session of sortedSessions) {
			const key = sessionKey(session);
			if (!session.telemetry) continue;

			const totalTokens =
				session.telemetry.tokens.input +
				session.telemetry.tokens.output +
				session.telemetry.tokens.cacheRead +
				session.telemetry.tokens.cacheWrite;

			let state = tokenStateMap.get(key);
			if (!state) {
				state = { lastTokenTotal: totalTokens, lastTimestamp: now, history: [] };
				tokenStateMap.set(key, state);
				continue; // Need at least two data points to compute a rate
			}

			const elapsedMinutes = (now - state.lastTimestamp) / 60_000;
			if (elapsedMinutes > 0) {
				const tokensPerMinute = (totalTokens - state.lastTokenTotal) / elapsedMinutes;

				state.history.push({
					timestamp: now,
					tokensPerMinute: Math.max(0, tokensPerMinute)
				});

				// Cap at rolling window
				if (state.history.length > HISTORY_WINDOW) {
					state.history = state.history.slice(-HISTORY_WINDOW);
				}

				state.lastTokenTotal = totalTokens;
				state.lastTimestamp = now;
			}
		}

		// Evict token state for sessions no longer active (and not recently ended)
		for (const key of tokenStateMap.keys()) {
			if (!currentKeys.has(key) && !endedSessions.has(key)) {
				tokenStateMap.delete(key);
			}
		}
	});

	// ── Auto-select first session if only one, or clear if selected gone
	$effect(() => {
		const keys = sortedSessions.map(sessionKey);
		if (selectedSessionId && !keys.includes(selectedSessionId)) {
			selectedSessionId = null;
		}
		if (!selectedSessionId && sortedSessions.length === 1) {
			selectedSessionId = sessionKey(sortedSessions[0]);
		}
	});

	const selectedSession = $derived(
		selectedSessionId
			? sortedSessions.find((s) => sessionKey(s) === selectedSessionId) ?? null
			: null
	);

	const selectedTokenHistory = $derived(
		selectedSessionId ? (tokenStateMap.get(selectedSessionId)?.history ?? []) : []
	);

	function handleCardClick(session: EnrichedActiveSession) {
		const key = sessionKey(session);
		selectedSessionId = selectedSessionId === key ? null : key;
	}

	// ── Polling: route-specific 10s interval ──────────────────────
	$effect(() => {
		let cancelled = false;
		let nextTimer: ReturnType<typeof setTimeout> | undefined;

		async function poll() {
			if (cancelled) return;
			await invalidateAll();
			if (!cancelled) {
				nextTimer = setTimeout(poll, data.liveRefreshInterval ?? 10_000);
			}
		}

		nextTimer = setTimeout(poll, data.liveRefreshInterval ?? 10_000);

		return () => {
			cancelled = true;
			if (nextTimer !== undefined) clearTimeout(nextTimer);
		};
	});

	const totalSessionCount = $derived(sortedSessions.length + endedSessions.size);
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<h1 class="text-2xl font-bold text-foreground">Live Flight Deck</h1>
			<Badge variant={sortedSessions.length > 0 ? 'success' : 'outline'}>
				{sortedSessions.length} active
			</Badge>
		</div>
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			<span class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
			Polling every {Math.round((data.liveRefreshInterval ?? 10_000) / 1000)}s
		</div>
	</div>

	<!-- Empty state -->
	{#if sortedSessions.length === 0 && endedSessions.size === 0}
		<EmptyState
			icon="monitor"
			title="No active Claude sessions"
			description="Start a Claude Code session in your terminal to see it appear here in real time."
		/>
	{:else}
		<!-- Flight cards grid -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			{#each sortedSessions as session (sessionKey(session))}
				<div in:fly={{ y: 20, duration: 300 }} out:fade={{ duration: 200 }}>
					<button
						type="button"
						class="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl transition-shadow {selectedSessionId === sessionKey(session) ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'}"
						onclick={() => handleCardClick(session)}
					>
						<FlightCard {session} />
					</button>
				</div>
			{/each}

			<!-- Ended sessions (fading out) -->
			{#each [...endedSessions.entries()] as [key, session] (key)}
				<div out:fade={{ duration: 500 }} class="relative opacity-50">
					<div class="pointer-events-none">
						<FlightCard {session} />
					</div>
					<div class="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60">
						<Badge variant="secondary">Session ended</Badge>
					</div>
				</div>
			{/each}
		</div>

		<!-- Expanded detail view for selected session -->
		{#if selectedSession}
			<div class="space-y-4" in:fly={{ y: 10, duration: 200 }}>
				<div class="flex items-center gap-2">
					<Icon name="activity" size={16} class="text-foreground" />
					<h2 class="text-sm font-medium text-foreground">Session Details</h2>
					{#if selectedSession.project}
						<span class="truncate text-xs text-muted-foreground">
							{selectedSession.project.replace(/\/$/, '').split('/').pop()}
						</span>
					{/if}
				</div>

				<!-- Three-panel detail layout -->
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
					<!-- Burn Rate Chart -->
					<div class="rounded-xl border border-border bg-card p-4 lg:col-span-2">
						<h3 class="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
							<Icon name="trending-up" size={14} />
							Token Burn Rate (tokens/min)
						</h3>
						<BurnRateChart tokenHistory={selectedTokenHistory} />
					</div>

					<!-- Tool Call Feed -->
					<div class="rounded-xl border border-border bg-card p-4">
						<h3 class="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
							<Icon name="wrench" size={14} />
							Tool Calls
						</h3>
						<ToolCallFeed toolCalls={selectedSession.telemetry?.recentToolCalls ?? []} />
					</div>
				</div>

				<!-- File Activity Feed -->
				<div class="rounded-xl border border-border bg-card p-4">
					<h3 class="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
						<Icon name="file-text" size={14} />
						File Activity
					</h3>
					<FileActivityFeed fileMutations={selectedSession.telemetry?.recentFiles ?? []} />
				</div>
			</div>
		{/if}
	{/if}

	<!-- Activity Feed (kept from original, below flight deck) -->
	<div class="rounded-xl border border-border bg-card">
		<div class="border-b border-border px-4 py-3">
			<div class="flex items-center gap-2">
				<Icon name="clock" size={16} class="text-foreground" />
				<h2 class="text-sm font-medium text-foreground">Recent Activity</h2>
				<span class="text-xs text-muted-foreground">Last 24 hours</span>
			</div>
		</div>

		{#if data.events.length === 0}
			<div class="px-4 py-4">
				<EmptyState
					icon="calendar"
					title="No recent activity."
					description="Commits and session starts from the last 24 hours will appear here."
				/>
			</div>
		{:else}
			<div class="divide-y divide-border/50">
				{#each data.events as event, i (event.timestamp + '-' + i)}
					<div class="flex gap-3 px-4 py-2.5">
						<div class="mt-0.5 shrink-0">
							<Icon
								name={event.type === 'commit' ? 'git-branch' : 'messages-square'}
								size={14}
								class={event.type === 'commit'
									? 'text-emerald-500 dark:text-emerald-400'
									: 'text-blue-500 dark:text-blue-400'}
							/>
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm text-foreground">{event.title}</p>
							<p class="text-xs text-muted-foreground">{event.detail}</p>
						</div>
						<span class="shrink-0 text-xs text-muted-foreground">
							{formatTimestamp(event.timestamp)}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<script lang="ts" module>
	function formatTimestamp(ts: number): string {
		const now = Date.now();
		const diff = now - ts;

		if (diff < 60_000) return 'Just now';
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>
