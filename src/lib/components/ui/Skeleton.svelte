<script lang="ts">
	interface Props {
		class?: string;
		width?: string;
		height?: string;
		rounded?: boolean;
	}

	const {
		class: className = '',
		width,
		height,
		rounded = false
	}: Props = $props();
</script>

<div
	class="animate-pulse bg-muted {rounded ? 'rounded-full' : 'rounded-md'} {className}"
	style:width={width}
	style:height={height}
	aria-hidden="true"
	role="presentation"
></div>
