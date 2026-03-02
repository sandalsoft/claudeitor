<script lang="ts">
	interface Props {
		startTime: string;
		class?: string;
	}

	const { startTime, class: className = '' }: Props = $props();

	let elapsed = $state(computeElapsed());

	function computeElapsed(): number {
		const startMs = new Date(startTime).getTime();
		if (Number.isNaN(startMs)) return 0;
		return Math.max(0, Date.now() - startMs);
	}

	function formatDuration(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	$effect(() => {
		const id = setInterval(() => {
			elapsed = computeElapsed();
		}, 1000);
		return () => clearInterval(id);
	});

	const display = $derived(formatDuration(elapsed));
</script>

<span class="tabular-nums {className}">{display}</span>
