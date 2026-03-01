<script lang="ts">
	import { Command } from 'bits-ui';
	import { Dialog } from 'bits-ui';
	import { goto } from '$app/navigation';
	import Icon from './Icon.svelte';
	import { navSections } from '$lib/stores/navigation';

	interface PaletteItem {
		label: string;
		href: string;
		icon: string;
		category: string;
		keywords?: string[];
	}

	// Build the item list from navigation sections + settings
	function buildItems(): PaletteItem[] {
		const items: PaletteItem[] = [];
		for (const section of navSections) {
			for (const item of section.items) {
				items.push({
					label: item.label,
					href: item.href,
					icon: item.icon,
					category: section.title,
					keywords: [section.title.toLowerCase(), item.label.toLowerCase()]
				});
			}
		}
		// Settings lives outside navSections
		items.push({
			label: 'Settings',
			href: '/settings',
			icon: 'settings',
			category: 'System',
			keywords: ['settings', 'config', 'preferences', 'system']
		});
		return items;
	}

	const items = buildItems();

	// Group items by category for display
	const groupedItems = $derived(() => {
		const groups = new Map<string, PaletteItem[]>();
		for (const item of items) {
			const list = groups.get(item.category) ?? [];
			list.push(item);
			groups.set(item.category, list);
		}
		return groups;
	});

	let open = $state(false);

	function handleSelect(href: string) {
		open = false;
		goto(href);
	}

	// Register global Cmd+K / Ctrl+K
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			open = !open;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
		/>
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl"
			aria-label="Command palette"
		>
			<Command.Root
				label="Command palette"
				class="flex flex-col"
				loop
			>
				<div class="flex items-center gap-2 border-b border-border px-3">
					<Icon name="search" size={16} class="shrink-0 text-muted-foreground" />
					<Command.Input
						placeholder="Search pages..."
						class="h-11 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
					/>
					<kbd
						class="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline"
					>
						ESC
					</kbd>
				</div>

				<Command.List class="max-h-72 overflow-y-auto px-1 py-2">
					<Command.Empty class="px-3 py-6 text-center text-sm text-muted-foreground">
						No results found.
					</Command.Empty>

					{#each [...groupedItems().entries()] as [category, categoryItems] (category)}
						<Command.Group value={category}>
							<Command.GroupHeading
								class="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
							>
								{category}
							</Command.GroupHeading>
							<Command.GroupItems>
								{#each categoryItems as item (item.href)}
									<Command.Item
										value={item.label}
										keywords={item.keywords}
										onSelect={() => handleSelect(item.href)}
										class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
									>
										<div
											class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted"
										>
											<Icon name={item.icon} size={14} class="text-muted-foreground" />
										</div>
										<span class="flex-1 truncate">{item.label}</span>
										<span class="text-xs text-muted-foreground">{item.category}</span>
									</Command.Item>
								{/each}
							</Command.GroupItems>
						</Command.Group>
					{/each}
				</Command.List>

				<!-- Footer hint -->
				<div
					class="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-muted-foreground"
				>
					<div class="flex items-center gap-3">
						<span class="flex items-center gap-1">
							<kbd class="rounded border border-border bg-muted px-1 py-0.5 font-mono">&#8593;</kbd>
							<kbd class="rounded border border-border bg-muted px-1 py-0.5 font-mono">&#8595;</kbd>
							Navigate
						</span>
						<span class="flex items-center gap-1">
							<kbd class="rounded border border-border bg-muted px-1 py-0.5 font-mono">&#8629;</kbd>
							Select
						</span>
					</div>
					<span class="flex items-center gap-1">
						<kbd class="rounded border border-border bg-muted px-1 py-0.5 font-mono">&#8984;K</kbd>
						Toggle
					</span>
				</div>
			</Command.Root>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
