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

	function getSnoozedAlerts(): Record<string, number> {
		try {
			const raw = localStorage.getItem(SNOOZE_KEY);
			if (!raw) return {};
			return JSON.parse(raw);
		} catch {
			return {};
		}
	}

	function isSnoozed(): boolean {
		const snoozed = getSnoozedAlerts();
		const until = snoozed[id];
		if (!until) return false;
		if (Date.now() >= until) {
			// Snooze expired, clean up
			delete snoozed[id];
			localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozed));
			return false;
		}
		return true;
	}

	function snooze(duration: SnoozeDuration) {
		const entry = snoozeDurations.find((d) => d.value === duration);
		if (!entry) return;
		const snoozed = getSnoozedAlerts();
		snoozed[id] = Date.now() + entry.ms;
		localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozed));
		snoozeMenuOpen = false;
		snoozedState = true;
	}

	let snoozedState = $state(false);
	let snoozeMenuOpen = $state(false);

	// Check snooze status on mount
	$effect(() => {
		snoozedState = isSnoozed();
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
