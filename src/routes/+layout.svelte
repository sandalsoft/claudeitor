<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import CommandPalette from '$lib/components/layout/CommandPalette.svelte';
	import { beforeNavigate, afterNavigate } from '$app/navigation';
	import { theme } from '$lib/stores/theme.svelte';
	import { navigation } from '$lib/stores/navigation.svelte';

	let { children } = $props();

	// Initialize theme and navigation on mount (browser only)
	$effect(() => {
		theme.init();
		navigation.init();
	});

	// Apply dark class to <html> element reactively
	$effect(() => {
		const el = document.documentElement;
		if (theme.resolved === 'dark') {
			el.classList.add('dark');
		} else {
			el.classList.remove('dark');
		}
	});

	// ─── Client-side navigation telemetry ───────────────────────
	// Tracks every SvelteKit client navigation (link clicks, programmatic goto,
	// back/forward) and reports timing + route info to the telemetry endpoint.

	const TELEMETRY_ENDPOINT = '/api/telemetry';
	let navStart: { from: string; to: string; timestamp: number } | null = null;

	function sendNavTelemetry(record: Record<string, unknown>): void {
		try {
			const payload = JSON.stringify(record);
			const sent = navigator.sendBeacon?.(TELEMETRY_ENDPOINT, payload);
			if (!sent) {
				fetch(TELEMETRY_ENDPOINT, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: payload,
					keepalive: true
				}).catch(() => {});
			}
		} catch {
			// Telemetry must never break the app
		}
	}

	beforeNavigate(({ from, to, type }) => {
		navStart = {
			from: from?.url.pathname ?? '(unknown)',
			to: to?.url.pathname ?? '(external)',
			timestamp: Date.now()
		};

		sendNavTelemetry({
			recordType: 'client-navigation',
			timestamp: navStart.timestamp,
			severityText: 'INFO',
			severityNumber: 9,
			body: `Navigation start: ${navStart.from} → ${navStart.to}`,
			attributes: {
				'navigation.type': type,
				'navigation.from': navStart.from,
				'navigation.to': navStart.to,
				'navigation.phase': 'before'
			}
		});
	});

	afterNavigate(({ from, to, type }) => {
		const duration = navStart ? Date.now() - navStart.timestamp : 0;

		sendNavTelemetry({
			recordType: 'client-navigation',
			timestamp: Date.now(),
			severityText: duration > 3000 ? 'WARN' : 'INFO',
			severityNumber: duration > 3000 ? 13 : 9,
			body: `Navigation complete: ${from?.url.pathname ?? '(initial)'} → ${to?.url.pathname ?? '(unknown)'} (${duration}ms)`,
			attributes: {
				'navigation.type': type,
				'navigation.from': from?.url.pathname ?? '(initial)',
				'navigation.to': to?.url.pathname ?? '(unknown)',
				'navigation.phase': 'after',
				'navigation.duration_ms': duration
			}
		});

		navStart = null;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Claudeitor</title>
</svelte:head>

<div class="flex h-screen overflow-hidden bg-background text-foreground">
	<Sidebar />

	<div class="flex min-w-0 flex-1 flex-col">
		<Header />

		<main class="flex-1 overflow-y-auto p-6">
			{@render children()}
		</main>
	</div>
</div>

<CommandPalette />
