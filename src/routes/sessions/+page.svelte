<script lang="ts">
	import SessionList from '$lib/components/sessions/SessionList.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-foreground">Sessions</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Browse and search your Claude Code session history.
		</p>
	</div>

	<SessionList
		sessions={data.sessions}
		totalCount={data.totalCount}
		totalPages={data.totalPages}
		currentPage={data.currentPage}
		query={data.query}
		sortDir={data.sortDir}
	/>
</div>
