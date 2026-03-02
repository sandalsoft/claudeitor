<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import { theme, type ThemeMode } from '$lib/stores/theme.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// ── Form state ───────────────────────────────────────────────
	let claudeDir = $state(data.claudeDir);
	let repoDirs = $state<string[]>([...data.repoDirs]);
	let newRepoDir = $state('');
	let apiKey = $state('');
	let hasApiKey = $state(data.hasApiKey);
	let showApiKey = $state(false);
	let aiModel = $state(data.aiModel);
	let costAlertThreshold = $state(data.costAlertThreshold);
	let themeOverride = $state<ThemeMode>(data.themeOverride);

	// ── Save state ───────────────────────────────────────────────
	let saving = $state(false);
	let saveMessage = $state('');
	let saveError = $state(false);

	// ── Repo dir management ──────────────────────────────────────
	function addRepoDir() {
		const trimmed = newRepoDir.trim();
		if (trimmed.length === 0) return;
		if (repoDirs.includes(trimmed)) return;
		repoDirs = [...repoDirs, trimmed];
		newRepoDir = '';
	}

	function removeRepoDir(index: number) {
		repoDirs = repoDirs.filter((_, i) => i !== index);
	}

	function moveRepoDir(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= repoDirs.length) return;
		const next = [...repoDirs];
		[next[index], next[target]] = [next[target], next[index]];
		repoDirs = next;
	}

	// ── Save handler ─────────────────────────────────────────────
	async function handleSave() {
		saving = true;
		saveMessage = '';
		saveError = false;

		try {
			const body: Record<string, unknown> = {
				claudeDir,
				repoDirs,
				aiModel,
				costAlertThreshold,
				themeOverride
			};

			// Only send API key if user typed something
			if (apiKey.length > 0) {
				body.anthropicApiKey = apiKey;
			}

			const res = await fetch('/api/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			const result = await res.json();

			if (result.success) {
				saveMessage = 'Settings saved successfully.';
				saveError = false;
				hasApiKey = result.hasApiKey;
				apiKey = '';

				// Apply theme immediately
				theme.setMode(themeOverride);
			} else {
				saveMessage = result.error || 'Failed to save settings.';
				saveError = true;
			}
		} catch {
			saveMessage = 'Network error. Could not save settings.';
			saveError = true;
		} finally {
			saving = false;
			// Clear message after 4 seconds
			setTimeout(() => {
				saveMessage = '';
			}, 4000);
		}
	}

	function handleKeydownRepoInput(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addRepoDir();
		}
	}

	// Tilde preview helper
	function tildePreview(path: string): string | null {
		if (path.startsWith('~/') || path === '~') {
			return path.replace(/^~/, '$HOME');
		}
		return null;
	}
</script>

<div class="mx-auto max-w-2xl space-y-8">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Settings</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Configure Claudeitor dashboard preferences. Settings are saved to claudeitor.config.json.
		</p>
	</div>

	<!-- General section -->
	<section class="space-y-4 rounded-xl border border-border bg-card p-5">
		<div class="flex items-center gap-2.5">
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
				<Icon name="folder" size={14} class="text-primary" />
			</div>
			<h2 class="text-base font-semibold text-foreground">General</h2>
		</div>

		<!-- Claude directory -->
		<div class="space-y-1.5">
			<label for="claude-dir" class="text-sm font-medium text-foreground">Claude Directory</label>
			<input
				id="claude-dir"
				type="text"
				bind:value={claudeDir}
				class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
				placeholder="~/.claude"
			/>
			{#if tildePreview(claudeDir)}
				<p class="text-xs text-muted-foreground">Expands to: {tildePreview(claudeDir)}</p>
			{/if}
		</div>

		<!-- Repo directories -->
		<div class="space-y-2">
			<span class="text-sm font-medium text-foreground" id="repo-dirs-label">Repository Directories</span>
			<p class="text-xs text-muted-foreground">
				Directories scanned for git repositories. Use ~ for home directory.
			</p>

			{#if repoDirs.length > 0}
				<ul class="space-y-1">
					{#each repoDirs as dir, i (dir + i)}
						<li
							class="group flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
						>
							<div class="flex flex-col gap-0.5">
								<button
									onclick={() => moveRepoDir(i, -1)}
									class="p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-30"
									disabled={i === 0}
									aria-label="Move up"
								>
									<Icon name="chevron-up" size={10} />
								</button>
								<button
									onclick={() => moveRepoDir(i, 1)}
									class="p-0.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-30"
									disabled={i === repoDirs.length - 1}
									aria-label="Move down"
								>
									<Icon name="chevron-down" size={10} />
								</button>
							</div>
							<span class="flex-1 truncate font-mono text-sm text-foreground">{dir}</span>
							{#if tildePreview(dir)}
								<span class="hidden text-xs text-muted-foreground sm:inline">
									{tildePreview(dir)}
								</span>
							{/if}
							<button
								onclick={() => removeRepoDir(i)}
								class="shrink-0 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
								aria-label="Remove {dir}"
							>
								<Icon name="trash" size={14} />
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="flex gap-2">
				<input
					type="text"
					bind:value={newRepoDir}
					onkeydown={handleKeydownRepoInput}
					class="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
					placeholder="~/Development/projects"
				/>
				<button
					onclick={addRepoDir}
					class="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
				>
					<Icon name="plus" size={14} />
					Add
				</button>
			</div>
		</div>
	</section>

	<!-- API section -->
	<section class="space-y-4 rounded-xl border border-border bg-card p-5">
		<div class="flex items-center gap-2.5">
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
				<Icon name="key" size={14} class="text-primary" />
			</div>
			<h2 class="text-base font-semibold text-foreground">API</h2>
		</div>

		<!-- API key -->
		<div class="space-y-1.5">
			<label for="api-key" class="text-sm font-medium text-foreground">Anthropic API Key</label>
			<p class="text-xs text-muted-foreground">
				Used for AI summaries. Stored locally, never sent to external services.
				{#if hasApiKey}
					<span class="inline-flex items-center gap-1 text-success">
						<Icon name="check" size={12} />
						Key configured
					</span>
				{/if}
			</p>
			<div class="flex gap-2">
				<div class="relative flex-1">
					<input
						id="api-key"
						type={showApiKey ? 'text' : 'password'}
						bind:value={apiKey}
						class="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
						placeholder={hasApiKey ? '(key configured - enter new key to change)' : 'sk-ant-...'}
						autocomplete="off"
					/>
					<button
						onclick={() => (showApiKey = !showApiKey)}
						class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
						aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
					>
						<Icon name={showApiKey ? 'eye-off' : 'eye'} size={14} />
					</button>
				</div>
			</div>
		</div>

		<!-- Model selection -->
		<div class="space-y-1.5">
			<label for="ai-model" class="text-sm font-medium text-foreground">AI Model</label>
			<p class="text-xs text-muted-foreground">
				Model used for AI-generated session summaries.
			</p>
			{#if data.availableModels.length > 0}
				<select
					id="ai-model"
					bind:value={aiModel}
					class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
				>
					{#each data.availableModels as model (model)}
						<option value={model}>{model}</option>
					{/each}
					{#if !data.availableModels.includes(aiModel)}
						<option value={aiModel}>{aiModel} (current)</option>
					{/if}
				</select>
			{:else}
				<input
					id="ai-model"
					type="text"
					bind:value={aiModel}
					class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
					placeholder="claude-sonnet-4-5-20250929"
				/>
				<p class="text-xs text-muted-foreground">
					No pricing data available. Enter model ID manually.
				</p>
			{/if}
		</div>
	</section>

	<!-- Alerts section -->
	<section class="space-y-4 rounded-xl border border-border bg-card p-5">
		<div class="flex items-center gap-2.5">
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
				<Icon name="alert-triangle" size={14} class="text-primary" />
			</div>
			<h2 class="text-base font-semibold text-foreground">Alerts</h2>
		</div>

		<!-- Cost threshold -->
		<div class="space-y-1.5">
			<label for="cost-threshold" class="text-sm font-medium text-foreground"
				>Cost Alert Threshold ($)</label
			>
			<p class="text-xs text-muted-foreground">
				Trigger an alert when daily costs exceed this amount.
			</p>
			<input
				id="cost-threshold"
				type="number"
				min="0"
				step="1"
				bind:value={costAlertThreshold}
				class="w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
			/>
		</div>
	</section>

	<!-- Display section -->
	<section class="space-y-4 rounded-xl border border-border bg-card p-5">
		<div class="flex items-center gap-2.5">
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
				<Icon name="monitor" size={14} class="text-primary" />
			</div>
			<h2 class="text-base font-semibold text-foreground">Display</h2>
		</div>

		<!-- Theme override -->
		<div class="space-y-2" role="group" aria-labelledby="theme-label">
			<span id="theme-label" class="text-sm font-medium text-foreground">Theme</span>
			<p class="text-xs text-muted-foreground">
				Override the system color scheme preference.
			</p>
			<div class="flex gap-2">
				{#each ['system', 'light', 'dark'] as mode (mode)}
					{@const active = themeOverride === mode}
					<button
						onclick={() => (themeOverride = mode as ThemeMode)}
						class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors
							{active
							? 'border-ring bg-accent font-medium text-accent-foreground'
							: 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						<Icon
							name={mode === 'system' ? 'monitor' : mode === 'light' ? 'sun' : 'moon'}
							size={14}
						/>
						{mode.charAt(0).toUpperCase() + mode.slice(1)}
					</button>
				{/each}
			</div>
		</div>
	</section>

	<!-- About section -->
	<section class="space-y-3 rounded-xl border border-border bg-card p-5">
		<div class="flex items-center gap-2.5">
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
				<Icon name="info" size={14} class="text-primary" />
			</div>
			<h2 class="text-base font-semibold text-foreground">About</h2>
		</div>

		<div class="space-y-1 text-sm text-muted-foreground">
			<p><span class="font-medium text-foreground">Claudeitor</span> v0.1.0</p>
			<p>Coding activity dashboard for Claude Code. Reads from ~/.claude/ and git repos.</p>
			<p>Localhost only. No data leaves your machine.</p>
		</div>
	</section>

	<!-- Save bar -->
	<div class="sticky bottom-0 -mx-6 border-t border-border bg-background/95 px-6 py-3 backdrop-blur-sm">
		<div class="mx-auto flex max-w-2xl items-center justify-between gap-4">
			{#if saveMessage}
				<p class="text-sm {saveError ? 'text-destructive' : 'text-success'}">
					{saveMessage}
				</p>
			{:else}
				<div></div>
			{/if}

			<button
				onclick={handleSave}
				disabled={saving}
				class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
			>
				{#if saving}
					<Icon name="loader" size={14} class="animate-spin" />
					Saving...
				{:else}
					<Icon name="save" size={14} />
					Save Settings
				{/if}
			</button>
		</div>
	</div>
</div>
