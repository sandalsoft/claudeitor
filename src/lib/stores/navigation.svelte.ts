// Navigation store for sidebar state using Svelte 5 runes.

export interface NavItem {
	label: string;
	href: string;
	icon: string;
	stub?: boolean;
}

export interface NavSection {
	title: string;
	items: NavItem[];
}

function createNavigationStore() {
	let collapsed = $state(false);

	function init() {
		const saved = localStorage.getItem('claudeitor-sidebar-collapsed');
		if (saved === 'true') {
			collapsed = true;
		}

		// Auto-collapse on narrow screens
		if (window.innerWidth < 768) {
			collapsed = true;
		}
	}

	function toggle() {
		collapsed = !collapsed;
		localStorage.setItem('claudeitor-sidebar-collapsed', String(collapsed));
	}

	function setCollapsed(value: boolean) {
		collapsed = value;
		localStorage.setItem('claudeitor-sidebar-collapsed', String(value));
	}

	return {
		get collapsed() {
			return collapsed;
		},
		init,
		toggle,
		setCollapsed
	};
}

export const navigation = createNavigationStore();

// Sidebar section definitions matching epic spec hierarchy
export const navSections: NavSection[] = [
	{
		title: 'Overview',
		items: [{ label: 'Readout', href: '/', icon: 'gauge' }]
	},
	{
		title: 'Monitor',
		items: [
			{ label: 'Live', href: '/live', icon: 'activity' },
			{ label: 'Sessions', href: '/sessions', icon: 'messages-square' },
			{ label: 'Costs', href: '/costs', icon: 'dollar-sign' },
			{ label: 'Setup', href: '/setup', icon: 'wrench' },
			{ label: 'Ports', href: '/ports', icon: 'network' }
		]
	},
	{
		title: 'Workspace',
		items: [
			{ label: 'Repos', href: '/repos', icon: 'git-branch' },
			{ label: 'Work Graph', href: '/work-graph', icon: 'git-merge' },
			{ label: 'Repo Pulse', href: '/repo-pulse', icon: 'heart-pulse' },
			{ label: 'Timeline', href: '/timeline', icon: 'calendar' },
			{ label: 'Diffs', href: '/diffs', icon: 'diff' },
			{ label: 'Snapshots', href: '/snapshots', icon: 'camera' }
		]
	},
	{
		title: 'Config',
		items: [
			{ label: 'Skills', href: '/skills', icon: 'sparkles' },
			{ label: 'Agents', href: '/agents', icon: 'bot' },
			{ label: 'Memory', href: '/memory', icon: 'brain' },
			{ label: 'Hooks', href: '/hooks', icon: 'webhook' }
		]
	},
	{
		title: 'Health',
		items: [
			{ label: 'Hygiene', href: '/hygiene', icon: 'shield-check' },
			{ label: 'Deps', href: '/deps', icon: 'package' },
			{ label: 'Worktrees', href: '/worktrees', icon: 'folder-tree' },
			{ label: 'Env', href: '/env', icon: 'variable' },
			{ label: 'Lint', href: '/lint', icon: 'check-circle' }
		]
	},
	{
		title: 'Extend',
		items: [
			{ label: 'Extensions', href: '/extensions', icon: 'puzzle' }
		]
	}
];
