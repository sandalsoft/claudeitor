<script lang="ts">
	import { navigation } from '$lib/stores/navigation';
	import { theme } from '$lib/stores/theme';
	import Icon from './Icon.svelte';

	// Time-aware greeting based on current hour
	function getGreeting(): string {
		const hour = new Date().getHours();
		if (hour < 6) return 'Night owl session';
		if (hour < 12) return 'Morning session';
		if (hour < 17) return 'Afternoon session';
		if (hour < 21) return 'Evening session';
		return 'Night session';
	}

	let greeting = $state(getGreeting());

	// Update greeting every minute
	$effect(() => {
		const interval = setInterval(() => {
			greeting = getGreeting();
		}, 60_000);
		return () => clearInterval(interval);
	});

	const themeIcon = $derived(
		theme.resolved === 'dark' ? 'moon' : 'sun'
	);

	const themeLabel = $derived(
		theme.mode === 'system'
			? `System (${theme.resolved})`
			: theme.mode === 'light'
				? 'Light'
				: 'Dark'
	);
</script>

<header
	class="flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm"
>
	<div class="flex items-center gap-3">
		<button
			onclick={() => navigation.toggle()}
			class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
			aria-label="Toggle sidebar"
		>
			<Icon name="menu" size={20} />
		</button>

		<div class="flex items-center gap-2">
			<span class="text-sm font-medium text-foreground">{greeting}</span>
		</div>
	</div>

	<div class="flex items-center gap-2">
		<button
			onclick={() => theme.toggle()}
			class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			aria-label="Toggle theme ({themeLabel})"
			title={themeLabel}
		>
			{#if theme.mode === 'system'}
				<Icon name="monitor" size={18} />
			{:else}
				<Icon name={themeIcon} size={18} />
			{/if}
		</button>
	</div>
</header>
