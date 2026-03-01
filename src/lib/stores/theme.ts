// Theme store using Svelte 5 runes.
// Respects system prefers-color-scheme, toggleable via class strategy.

export type ThemeMode = 'system' | 'light' | 'dark';

function createThemeStore() {
	let mode = $state<ThemeMode>('system');
	let systemPrefersDark = $state(false);

	const resolved = $derived<'light' | 'dark'>(
		mode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : mode
	);

	function init() {
		// Read persisted preference
		const saved = localStorage.getItem('claudeitor-theme') as ThemeMode | null;
		if (saved === 'light' || saved === 'dark' || saved === 'system') {
			mode = saved;
		}

		// Detect system preference
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		systemPrefersDark = mq.matches;
		mq.addEventListener('change', (e) => {
			systemPrefersDark = e.matches;
		});
	}

	function setMode(newMode: ThemeMode) {
		mode = newMode;
		localStorage.setItem('claudeitor-theme', newMode);
	}

	function toggle() {
		if (mode === 'system') {
			setMode(systemPrefersDark ? 'light' : 'dark');
		} else if (mode === 'light') {
			setMode('dark');
		} else {
			setMode('system');
		}
	}

	return {
		get mode() {
			return mode;
		},
		get resolved() {
			return resolved;
		},
		init,
		setMode,
		toggle
	};
}

export const theme = createThemeStore();
