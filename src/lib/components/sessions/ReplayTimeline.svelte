<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';

	interface Props {
		/** Total number of messages in the session. */
		totalMessages: number;
		/** Current position (0 to totalMessages). Controls how many messages are visible. */
		position: number;
		/** Callback when user changes position. */
		onchange: (position: number) => void;
		/** Start time of session (ISO string). */
		startTime: string;
		/** End time of session (ISO string). */
		endTime: string;
	}

	const { totalMessages, position, onchange, startTime, endTime }: Props = $props();

	let isPlaying = $state(false);
	let playInterval: ReturnType<typeof setInterval> | null = null;

	function play() {
		if (position >= totalMessages) {
			onchange(0);
		}
		isPlaying = true;
		playInterval = setInterval(() => {
			if (position >= totalMessages) {
				pause();
				return;
			}
			onchange(position + 1);
		}, 400);
	}

	function pause() {
		isPlaying = false;
		if (playInterval) {
			clearInterval(playInterval);
			playInterval = null;
		}
	}

	function skipToStart() {
		pause();
		onchange(0);
	}

	function skipToEnd() {
		pause();
		onchange(totalMessages);
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		onchange(parseInt(target.value, 10));
	}

	function formatTime(isoStr: string): string {
		return new Date(isoStr).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	// Clean up interval on component destroy
	$effect(() => {
		return () => {
			if (playInterval) clearInterval(playInterval);
		};
	});
</script>

<div class="rounded-xl border border-border bg-card p-4">
	<div class="flex items-center gap-3">
		<!-- Playback controls -->
		<div class="flex items-center gap-1">
			<button
				onclick={skipToStart}
				class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
				title="Skip to start"
				aria-label="Skip to start"
			>
				<Icon name="skip-back" size={14} />
			</button>

			{#if isPlaying}
				<button
					onclick={pause}
					class="rounded-md bg-primary p-1.5 text-primary-foreground hover:bg-primary/90"
					title="Pause"
					aria-label="Pause replay"
				>
					<Icon name="pause" size={14} />
				</button>
			{:else}
				<button
					onclick={play}
					class="rounded-md bg-primary p-1.5 text-primary-foreground hover:bg-primary/90"
					title="Play"
					aria-label="Play replay"
				>
					<Icon name="play" size={14} />
				</button>
			{/if}

			<button
				onclick={skipToEnd}
				class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
				title="Skip to end"
				aria-label="Skip to end"
			>
				<Icon name="skip-forward" size={14} />
			</button>
		</div>

		<!-- Timeline slider -->
		<div class="flex min-w-0 flex-1 items-center gap-3">
			<span class="shrink-0 text-xs text-muted-foreground">
				{formatTime(startTime)}
			</span>
			<input
				type="range"
				min="0"
				max={totalMessages}
				value={position}
				oninput={handleInput}
				class="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
				aria-label="Session replay position"
			/>
			<span class="shrink-0 text-xs text-muted-foreground">
				{formatTime(endTime)}
			</span>
		</div>

		<!-- Position indicator -->
		<span class="shrink-0 text-xs tabular-nums text-muted-foreground">
			{position} / {totalMessages}
		</span>
	</div>
</div>
