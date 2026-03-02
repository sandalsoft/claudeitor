// Core data types for the Claudeitor dashboard data layer.
// These interfaces mirror the on-disk JSON schemas in ~/.claude/

// ─── Stats Cache (stats-cache.json) ────────────────────────────

export interface DailyActivity {
	date: string;
	messageCount: number;
	sessionCount: number;
	toolCallCount: number;
}

export interface DailyModelTokens {
	date: string;
	tokensByModel: Record<string, number>;
}

export interface ModelUsageEntry {
	inputTokens: number;
	outputTokens: number;
	cacheReadInputTokens: number;
	cacheCreationInputTokens: number;
	webSearchRequests: number;
	costUSD: number;
	contextWindow: number;
	maxOutputTokens: number;
}

export interface StatsCache {
	version: number;
	lastComputedDate: string;
	dailyActivity: DailyActivity[];
	dailyModelTokens: DailyModelTokens[];
	modelUsage: Record<string, ModelUsageEntry>;
	totalSessions: number;
	totalMessages: number;
	longestSession: number;
	firstSessionDate: string;
	hourCounts: Record<string, number>;
	totalSpeculationTimeSavedMs: number;
}

// ─── Cost Cache (readout-cost-cache.json) ──────────────────────

export interface TokenUsage {
	cacheRead: number;
	cacheWrite: number;
	input: number;
	output: number;
}

export interface CostCache {
	version: number;
	lastFullScan: string;
	days: Record<string, Record<string, TokenUsage>>;
}

// ─── Pricing (readout-pricing.json) ────────────────────────────

export interface ModelPricing {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
}

export interface PricingData {
	updated: string;
	source: string;
	models: Record<string, ModelPricing>;
}

// ─── Session History (history.jsonl) ───────────────────────────

export interface SessionEntry {
	display: string;
	pastedContents: Record<string, unknown>;
	timestamp: number;
	project: string;
	sessionId?: string;
}

// ─── Skills & Agents ──────────────────────────────────────────

export interface SkillInfo {
	name: string;
	path: string;
	isSymlink: boolean;
	description?: string;
	disableModelInvocation?: boolean;
	fileCount: number;
	content?: string;
}

export interface AgentInfo {
	name: string;
	path: string;
	content: string;
	description?: string;
	model?: string;
	tools?: string[];
	color?: string;
}

// ─── Memory (CLAUDE.md files) ────────────────────────────────

export interface MemoryFile {
	label: string;
	path: string;
	content: string;
	lineCount: number;
	scope: 'global' | 'project' | 'child';
}

// ─── Settings (settings.json) ─────────────────────────────────

export interface HookEntry {
	type: string;
	command: string;
}

export interface HookMatcher {
	matcher: string;
	hooks: HookEntry[];
}

export interface SettingsData {
	env: Record<string, string>;
	model: string;
	hooks: Record<string, HookMatcher[]>;
	enabledPlugins: Record<string, boolean>;
}

// ─── Live Session Telemetry (session tailer) ─────────────────

export interface LiveToolCall {
	id: string;
	name: string;
	status: 'success' | 'error' | 'pending';
	filePath?: string;
	timestamp: string;
}

export interface LiveFileMutation {
	filePath: string;
	toolName: string;
	operation: 'read' | 'edit' | 'write' | 'notebook_edit' | 'other';
	timestamp: string;
}

export interface LiveSessionTelemetry {
	tokens: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
	};
	recentToolCalls: LiveToolCall[];
	recentFiles: LiveFileMutation[];
	messageCount: number;
	model: string;
}

// ─── Setup Check (/setup) ─────────────────────────────────────

export type SetupStatus = 'ok' | 'warn' | 'error';

export interface SetupCheck {
	label: string;
	status: SetupStatus;
	detail: string;
}

// ─── Extensions (/extensions) ─────────────────────────────────

export interface PluginSummary {
	id: string;
	enabled: boolean;
	version: string;
	scope: string;
	installedAt: string;
}

export interface ExtensionsSummary {
	skillCount: number;
	agentCount: number;
	plugins: PluginSummary[];
	mcpServerCount: number;
	mcpServerNames: string[];
	hookCount: number;
}

// ─── Environment Variables (/env) ─────────────────────────────

export interface EnvVariable {
	name: string;
	/** Repo paths where this variable is defined. */
	repos: string[];
}

// ─── Port Info (/ports) ──────────────────────────────────────

export interface PortInfo {
	/** Process name (e.g. "node", "nginx"). */
	command: string;
	/** Process ID. */
	pid: number;
	/** User owning the process. */
	user: string;
	/** Port number. */
	port: number;
	/** Protocol (e.g. "TCP"). */
	protocol: string;
	/** Full address binding (e.g. "*:3000", "127.0.0.1:8080"). */
	address: string;
}

// ─── Hygiene Issue (/hygiene) ─────────────────────────────────

export type HygieneSeverity = 'info' | 'warn' | 'error';

export interface StaleBranch {
	name: string;
	/** Unix timestamp (seconds) of last commit on this branch. */
	lastCommitUnix: number;
}

export interface HygieneIssue {
	/** Repository name. */
	repo: string;
	/** Repository path. */
	repoPath: string;
	/** Human-readable issue label. */
	label: string;
	/** Issue severity. */
	severity: HygieneSeverity;
	/** Short detail string. */
	detail: string;
	/** Stale branches list (only for stale-branches issues). */
	staleBranches?: StaleBranch[];
	/** Total stale branch count (may exceed staleBranches.length which is capped at 10). */
	staleBranchCount?: number;
}

// ─── Worktree Info (/worktrees) ──────────────────────────────

export interface WorktreeInfo {
	/** Absolute path to the worktree. */
	path: string;
	/** HEAD hash (or empty for bare). */
	head: string;
	/** Branch name (or "detached" / "bare"). */
	branch: string;
	/** Whether this is the main worktree. */
	isMain: boolean;
	/** Repository name this worktree belongs to. */
	repo: string;
	/** Repository path. */
	repoPath: string;
}

// ─── Dependency Audit (/deps) ─────────────────────────────────

export type DepAuditStatus = 'ok' | 'warn' | 'error' | 'timeout' | 'offline' | 'unavailable';

export interface AuditVulnerability {
	/** Severity level from npm audit. */
	severity: 'info' | 'low' | 'moderate' | 'high' | 'critical';
	/** Number of vulnerabilities at this severity. */
	count: number;
}

export interface OutdatedPackage {
	/** Package name. */
	name: string;
	/** Currently installed version. */
	current: string;
	/** Wanted version (semver-compatible). */
	wanted: string;
	/** Latest version available. */
	latest: string;
	/** Dependency type (dependencies, devDependencies, etc.). */
	type: string;
}

export interface DepAuditResult {
	/** Repository name. */
	repo: string;
	/** Repository path. */
	repoPath: string;
	/** Overall status of the audit. */
	status: DepAuditStatus;
	/** Status message (error details, "offline", etc.). */
	statusMessage: string;
	/** Total vulnerability count. */
	totalVulnerabilities: number;
	/** Vulnerability breakdown by severity. */
	vulnerabilities: AuditVulnerability[];
	/** Outdated packages list. */
	outdated: OutdatedPackage[];
}

// ─── Lint Results (/lint) ─────────────────────────────────────

export type LintSeverity = 'error' | 'warning';

export interface LintIssue {
	/** Source file path (relative to repo root). */
	filePath: string;
	/** Line number (1-based). */
	line: number;
	/** Column number (1-based). */
	column: number;
	/** Issue severity. */
	severity: LintSeverity;
	/** Issue message. */
	message: string;
	/** ESLint rule ID or "tsc" for TypeScript errors. */
	ruleId: string;
}

export interface LintResult {
	/** Repository name. */
	repo: string;
	/** Repository path. */
	repoPath: string;
	/** ESLint issues. */
	eslintIssues: LintIssue[];
	/** TypeScript compiler issues. */
	tscIssues: LintIssue[];
	/** Total error count. */
	errorCount: number;
	/** Total warning count. */
	warningCount: number;
	/** Whether eslint was available. */
	eslintAvailable: boolean;
	/** Whether tsc was available. */
	tscAvailable: boolean;
	/** Error message if lint failed entirely. */
	error?: string;
}

// ─── Branch Graph (/work-graph) ──────────────────────────────

export interface BranchNode {
	/** Unique ID: `${repoName}:${branchName}`. */
	id: string;
	/** Repository name. */
	repo: string;
	/** Branch name. */
	branch: string;
	/** Abbreviated commit hash at branch tip. */
	headShort: string;
	/** Committer date (ISO 8601). */
	date: string;
	/** Whether this is the default branch of its repo. */
	isDefault: boolean;
}

export interface BranchEdge {
	/** Source node ID (feature branch). */
	source: string;
	/** Target node ID (default branch / hub). */
	target: string;
	/** Merge-base commit hash (abbreviated). */
	mergeBase: string;
}

// ─── Repo Pulse (/repo-pulse) ────────────────────────────────

export interface RepoPulseInfo {
	/** Repository name. */
	name: string;
	/** Repository path. */
	path: string;
	/** Current branch name. */
	branch: string;
	/** Commits in the last 7 days. */
	commits7d: number;
	/** Commits in the last 30 days. */
	commits30d: number;
	/** Unique contributor names (from authorName). */
	contributors: string[];
	/** ISO 8601 date of most recent commit (empty if no commits). */
	lastCommitDate: string;
	/** Uncommitted file count. */
	uncommittedFileCount: number;
	/** Unpushed commit count. */
	unpushedCommitCount: number;
	/** Activity score: 7d commits * 3 + 30d commits. */
	activityScore: number;
	/** Daily commit counts for sparkline (last 30 days, index 0 = oldest). */
	sparkline: number[];
}

// ─── Session Diffs (/diffs) ──────────────────────────────────

export interface FileMutation {
	/** Absolute file path that was modified. */
	filePath: string;
	/** Tool that performed the mutation (Edit, Write, etc.). */
	tool: string;
	/** Simple diff content (unified-style), or null for full-file writes. */
	diff: string | null;
}

export interface SessionDiff {
	/** Session display text. */
	display: string;
	/** Session timestamp (ms since epoch). */
	timestamp: number;
	/** Project path. */
	project: string;
	/** Session ID (if available). */
	sessionId?: string;
	/** File mutations extracted from the session. */
	mutations: FileMutation[];
}

// ─── Snapshots (/snapshots) ──────────────────────────────────

export interface SnapshotEntry {
	/** Commit hash (full). */
	hash: string;
	/** Commit subject line. */
	subject: string;
	/** Author name. */
	authorName: string;
	/** Author email. */
	authorEmail: string;
	/** ISO 8601 date string. */
	date: string;
	/** Repository name. */
	repo: string;
	/** Repository path. */
	repoPath: string;
	/** Number of files changed in this commit (populated on current page only). */
	filesChanged: number;
}

// ─── Enriched Active Session (flight deck) ───────────────────

export interface EnrichedActiveSession {
	pid: number;
	command: string;
	startedAt: string;
	project?: string;
	sessionId?: string;
	cpuPercent: number;
	memPercent: number;
	telemetry: LiveSessionTelemetry | null;
	cost: number;
	displayModel: string;
	durationMs: number;
}
