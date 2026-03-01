<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import { theme } from '$lib/stores/theme';
	import { navigation } from '$lib/stores/navigation';

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
