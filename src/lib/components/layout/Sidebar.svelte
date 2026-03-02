<script lang="ts">
	import { page } from '$app/stores';
	import { navigation, navSections } from '$lib/stores/navigation.svelte';
	import Icon from './Icon.svelte';

	// Check if a path is the active route
	function isActive(href: string, pathname: string): boolean {
		if (href === '/') return pathname === '/';
		return pathname === href || pathname.startsWith(href + '/');
	}

	// Settings is rendered separately at the bottom
	const settingsItem = { label: 'Settings', href: '/settings', icon: 'settings' };

	// Derived: current path for active highlighting
	const currentPath = $derived($page.url.pathname);
</script>

<!-- Mobile overlay -->
{#if !navigation.collapsed}
	<button
		class="fixed inset-0 z-30 bg-black/50 md:hidden"
		onclick={() => navigation.setCollapsed(true)}
		aria-label="Close sidebar"
		tabindex="-1"
	></button>
{/if}

<aside
	class="fixed left-0 top-0 z-40 flex h-full flex-col border-r border-border bg-background transition-all duration-200 md:relative md:z-auto {navigation.collapsed
		? '-translate-x-full md:w-16 md:translate-x-0'
		: 'w-64 translate-x-0'}"
>
	<!-- Logo / Brand -->
	<div class="flex h-14 items-center border-b border-border px-3 {navigation.collapsed ? 'justify-center' : 'gap-3'}">
		{#if !navigation.collapsed}
			<a href="/" class="flex items-center gap-2.5 overflow-hidden">
				<div
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
				>
					<span class="text-sm font-bold">C</span>
				</div>
				<span class="truncate text-sm font-semibold text-foreground">Claudeitor</span>
			</a>
		{:else}
			<a href="/" class="flex items-center justify-center">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
				>
					<span class="text-sm font-bold">C</span>
				</div>
			</a>
		{/if}
	</div>

	<!-- Navigation sections -->
	<nav class="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
		{#each navSections as section}
			<div class="mb-3">
				{#if !navigation.collapsed}
					<div class="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						{section.title}
					</div>
				{:else}
					<div class="mb-1 border-b border-border/50"></div>
				{/if}

				<ul class="space-y-0.5">
					{#each section.items as item}
						{@const active = isActive(item.href, currentPath)}
						<li>
							<a
								href={item.href}
								class="group flex items-center rounded-md px-2 py-1.5 text-sm transition-colors
									{active
									? 'bg-accent font-medium text-accent-foreground'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground'}
									{navigation.collapsed ? 'justify-center' : 'gap-2.5'}"
								title={navigation.collapsed ? item.label : undefined}
								aria-current={active ? 'page' : undefined}
								onclick={() => {
									// Auto-close sidebar on mobile after navigation
									if (window.innerWidth < 768) {
										navigation.setCollapsed(true);
									}
								}}
							>
								<Icon
									name={item.icon}
									size={16}
									class="shrink-0 {active
										? 'text-accent-foreground'
										: 'text-muted-foreground group-hover:text-foreground'}"
								/>
								{#if !navigation.collapsed}
									<span class="truncate">{item.label}</span>
									{#if item.stub}
										<span
											class="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground"
										>
											Soon
										</span>
									{/if}
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</nav>

	<!-- Footer: Settings + collapse toggle -->
	<div class="border-t border-border px-2 py-2">
		<!-- Settings link -->
		<a
			href={settingsItem.href}
			class="group flex items-center rounded-md px-2 py-1.5 text-sm transition-colors
				{isActive(settingsItem.href, currentPath)
				? 'bg-accent font-medium text-accent-foreground'
				: 'text-muted-foreground hover:bg-muted hover:text-foreground'}
				{navigation.collapsed ? 'justify-center' : 'gap-2.5'}"
			title={navigation.collapsed ? settingsItem.label : undefined}
			aria-current={isActive(settingsItem.href, currentPath) ? 'page' : undefined}
		>
			<Icon name={settingsItem.icon} size={16} class="shrink-0" />
			{#if !navigation.collapsed}
				<span class="truncate">{settingsItem.label}</span>
			{/if}
		</a>

		<!-- Collapse toggle (desktop only) -->
		<button
			onclick={() => navigation.toggle()}
			class="hidden w-full items-center rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex {navigation.collapsed
				? 'justify-center'
				: 'gap-2.5'}"
			aria-label={navigation.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			<Icon name={navigation.collapsed ? 'chevron-right' : 'chevron-left'} size={16} class="shrink-0" />
			{#if !navigation.collapsed}
				<span class="truncate">Collapse</span>
			{/if}
		</button>
	</div>
</aside>
