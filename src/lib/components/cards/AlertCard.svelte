<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';

	type Severity = 'info' | 'warning' | 'error';
	type SnoozeDuration = '1h' | '1d' | '1w';

	interface Props {
		id: string;
		message: string;
		severity?: Severity;
		icon?: string;
		class?: string;
	}

	const {
		id,
		message,
		severity = 'info',
		icon,
		class: className = ''
	}: Props = $props();

	const SNOOZE_KEY = 'claudeitor-snoozed-alerts';

	const snoozeDurations: { label: string; value: SnoozeDuration; ms: number }[] = [
		{ label: '1 hour', value: '1h', ms: 60 * 60 * 1000 },
		{ label: '1 day', value: '1d', ms: 24 * 60 * 60 * 1000 },
		{ label: '1 week', value: '1w', ms: 7 * 24 * 60 * 60 * 1000 }
	];

	function safeStorageWrite(key: string, value: string): void {
		try {
			localStorage.setItem(key, value);
		} catch {
			// Storage unavailable (private browsing, quota exceeded) -- best-effort
		}
	}

	function getSnoozedAlerts(): Record<string, number> {
		try {
			const raw = localStorage.getItem(SNOOZE_KEY);
			if (!raw) return {};
			const parsed: unknown = JSON.parse(raw);
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
			// Validate: only keep entries with numeric timestamp values
			const result: Record<string, number> = {};
			for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
				if (typeof val === 'number' && Number.isFinite(val)) {
					result[key] = val;
				}
			}
			return result;
		} catch {
			return {};
		}
	}

	function getSnoozeRemaining(): number {
		const snoozed = getSnoozedAlerts();
		const until = snoozed[id];
		if (!until) return 0;
		const remaining = until - Date.now();
		if (remaining <= 0) {
			// Snooze expired, clean up
			delete snoozed[id];
			safeStorageWrite(SNOOZE_KEY, JSON.stringify(snoozed));
			return 0;
		}
		return remaining;
	}

	function snooze(duration: SnoozeDuration) {
		const entry = snoozeDurations.find((d) => d.value === duration);
		if (!entry) return;
		const snoozed = getSnoozedAlerts();
		const until = Date.now() + entry.ms;
		snoozed[id] = until;
		safeStorageWrite(SNOOZE_KEY, JSON.stringify(snoozed));
		snoozeMenuOpen = false;
		snoozedState = true;

		// Schedule auto-restore when snooze expires
		scheduleRestore(entry.ms);
	}

	function scheduleRestore(ms: number) {
		if (restoreTimer) clearTimeout(restoreTimer);
		// Cap at 2^31-1 ms (max setTimeout) to avoid overflow
		const safeMs = Math.min(ms, 2_147_483_647);
		restoreTimer = setTimeout(() => {
			snoozedState = false;
		}, safeMs);
	}

	let snoozedState = $state(false);
	let snoozeMenuOpen = $state(false);
	let restoreTimer: ReturnType<typeof setTimeout> | null = null;

	// Check snooze status on mount, schedule auto-restore if snoozed
	$effect(() => {
		const remaining = getSnoozeRemaining();
		snoozedState = remaining > 0;
		if (remaining > 0) {
			scheduleRestore(remaining);
		}
		return () => {
			if (restoreTimer) clearTimeout(restoreTimer);
		};
	});

	const severityBase: Record<Severity, { bg: string; border: string; defaultIcon: string; iconColor: string }> = {
		info: {
			bg: 'bg-card',
			border: 'border-border',
			defaultIcon: 'info',
			iconColor: 'text-muted-foreground'
		},
		warning: {
			bg: 'bg-warning/5 dark:bg-warning/10',
			border: 'border-warning/30',
			defaultIcon: 'alert-triangle',
			iconColor: 'text-warning'
		},
		error: {
			bg: 'bg-destructive/5 dark:bg-destructive/10',
			border: 'border-destructive/30',
			defaultIcon: 'alert-triangle',
			iconColor: 'text-destructive'
		}
	};

	const style = $derived.by(() => {
		const base = severityBase[severity];
		return { ...base, icon: icon ?? base.defaultIcon };
	});
</script>

{#if !snoozedState}
	<div
		class="relative flex items-start gap-3 rounded-xl border p-3 {style.bg} {style.border} {className}"
		role="alert"
	>
		<Icon name={style.icon} size={16} class="mt-0.5 shrink-0 {style.iconColor}" />

		<p class="min-w-0 flex-1 text-sm text-foreground">{message}</p>

		<div class="relative shrink-0">
			<button
				onclick={() => (snoozeMenuOpen = !snoozeMenuOpen)}
				class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Snooze alert"
				title="Snooze"
			>
				<Icon name="bell-off" size={14} />
			</button>

			{#if snoozeMenuOpen}
				<div class="absolute right-0 top-full z-10 mt-1 w-28 rounded-lg border border-border bg-card py-1 shadow-lg">
					{#each snoozeDurations as duration}
						<button
							onclick={() => snooze(duration.value)}
							class="w-full px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
						>
							{duration.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
