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
}

export interface AgentInfo {
	name: string;
	path: string;
	content: string;
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
