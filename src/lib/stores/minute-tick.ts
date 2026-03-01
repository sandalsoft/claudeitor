// Shared minute-tick store. A single setInterval drives all relative-time
// computations across the app, avoiding per-component timer overhead.

let tick = $state(0);
let interval: ReturnType<typeof setInterval> | null = null;
let refCount = 0;

/** Subscribe to minute ticks. Returns an unsubscribe function. */
export function subscribeMinuteTick(): () => void {
	refCount++;
	if (refCount === 1 && !interval) {
		interval = setInterval(() => {
			tick++;
		}, 60_000);
	}
	return () => {
		refCount--;
		if (refCount <= 0 && interval) {
			clearInterval(interval);
			interval = null;
			refCount = 0;
		}
	};
}

/** Current tick value. Read this in a $derived to trigger recalculation. */
export function getMinuteTick(): number {
	return tick;
}
