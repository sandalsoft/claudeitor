import type { PageServerLoad } from './$types';
import { detectActiveSessions, type ActiveSession } from '$lib/server/claude/active-sessions';
import { readSessionHistory } from '$lib/server/claude/sessions';
import { readConfig } from '$lib/server/config';
import { scanRepos } from '$lib/server/git/scanner';
import { withSpan } from '$lib/server/telemetry/span-helpers';
import { sessionTailer } from '$lib/server/claude/session-tailer';
import { readPricing } from '$lib/server/claude/costs';
import { mapModelId } from '$lib/server/claude/model-mapping';
import type { EnrichedActiveSession, PricingData, LiveSessionTelemetry } from '$lib/data/types';
import { warn } from '$lib/server/telemetry/logger';

const MODULE = 'load:live';

interface ActivityEvent {
	type: 'commit' | 'session';
	timestamp: number;
	title: string;
	detail: string;
	repo?: string;
}

// TTL cache for the activity feed to avoid re-scanning repos on every poll.
// Active session detection is cheap and always fresh; git+session scan is
// cached for 15 seconds so rapid polls don't shell out repeatedly.
// Keyed by config fingerprint to handle config changes at runtime.
let cachedEvents: ActivityEvent[] = [];
let cacheTimestamp = 0;
let cacheKey = '';
const CACHE_TTL_MS = 15_000;

/** Route-specific polling interval (10s for flight deck, distinct from global 30s). */
const LIVE_REFRESH_INTERVAL_MS = 10_000;

async function loadActivityEvents(
	claudeDir: string,
	repoDirs: string[]
): Promise<ActivityEvent[]> {
	const now = Date.now();
	const key = `${claudeDir}|${repoDirs.join(',')}`;
	if (key === cacheKey && cacheTimestamp > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
		return cachedEvents;
	}

	const [sessions, gitResult] = await Promise.all([
		readSessionHistory(claudeDir),
		scanRepos(repoDirs)
	]);

	const events: ActivityEvent[] = [];
	const oneDayAgo = now - 24 * 60 * 60 * 1000;

	// Add recent commits from all repos
	for (const repo of gitResult.repos) {
		for (const commit of repo.commits) {
			const commitTime = new Date(commit.date).getTime();
			if (commitTime >= oneDayAgo) {
				events.push({
					type: 'commit',
					timestamp: commitTime,
					title: commit.subject,
					detail: `${commit.authorName} in ${repo.name}`,
					repo: repo.name
				});
			}
		}
	}

	// Add recent sessions
	for (const session of sessions) {
		if (session.timestamp >= oneDayAgo) {
			const projectName = session.project
				? session.project.split('/').pop() ?? session.project
				: 'Unknown project';

			events.push({
				type: 'session',
				timestamp: session.timestamp,
				title: session.display.slice(0, 100),
				detail: projectName
			});
		}
	}

	// Sort newest first, limit to 50
	events.sort((a, b) => b.timestamp - a.timestamp);
	cachedEvents = events.slice(0, 50);
	cacheTimestamp = now;
	cacheKey = key;

	return cachedEvents;
}

/**
 * Calculate token cost using the per-million pricing formula.
 *
 * Formula: (tokens / 1_000_000) * ratePerMillion
 * Applied per token type: input, output, cacheRead, cacheWrite.
 */
function calculateSessionCost(
	tokens: LiveSessionTelemetry['tokens'],
	modelId: string,
	pricing: PricingData
): number {
	const pricingKey = mapModelId(modelId, pricing);
	const rates = pricing.models[pricingKey];
	if (!rates) return 0;

	return (
		(tokens.input / 1_000_000) * rates.input +
		(tokens.output / 1_000_000) * rates.output +
		(tokens.cacheRead / 1_000_000) * rates.cacheRead +
		(tokens.cacheWrite / 1_000_000) * rates.cacheWrite
	);
}

/**
 * Compute session duration in milliseconds from the startedAt ISO timestamp.
 */
function computeDurationMs(startedAt: string): number {
	const startMs = new Date(startedAt).getTime();
	if (Number.isNaN(startMs)) return 0;
	return Math.max(0, Date.now() - startMs);
}

/**
 * Enrich a single ActiveSession with telemetry, cost, display model name,
 * and duration. If the session has no sessionId or the JSONL file cannot
 * be located, returns the session with null telemetry and zero cost.
 */
async function enrichSession(
	session: ActiveSession,
	claudeDir: string,
	pricing: PricingData
): Promise<EnrichedActiveSession> {
	const durationMs = computeDurationMs(session.startedAt);

	if (!session.sessionId) {
		return {
			...session,
			telemetry: null,
			cost: 0,
			displayModel: 'unknown',
			durationMs
		};
	}

	let telemetry: LiveSessionTelemetry | null;
	try {
		telemetry = await sessionTailer.tail(session.sessionId, claudeDir);
	} catch (err) {
		warn(MODULE, 'Failed to tail session JSONL', {
			'session.id': session.sessionId,
			'error.message': err instanceof Error ? err.message : String(err)
		});
		telemetry = null;
	}

	if (!telemetry) {
		return {
			...session,
			telemetry: null,
			cost: 0,
			displayModel: 'unknown',
			durationMs
		};
	}

	const cost = calculateSessionCost(telemetry.tokens, telemetry.model, pricing);
	const displayModel = telemetry.model
		? mapModelId(telemetry.model, pricing)
		: 'unknown';

	return {
		...session,
		telemetry,
		cost,
		displayModel,
		durationMs
	};
}

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:live',
		{
			'code.filepath': 'src/routes/live/+page.server.ts',
			'http.route': '/live'
		},
		async () => {
			const config = await readConfig();

			// Active sessions are always fresh (cheap ps command);
			// activity feed uses a TTL cache to throttle git scanning;
			// pricing is needed for cost calculation.
			const [activeSessions, events, pricing] = await Promise.all([
				detectActiveSessions(config.claudeDir),
				loadActivityEvents(config.claudeDir, config.repoDirs),
				readPricing(config.claudeDir)
			]);

			// Enrich each active session with telemetry, cost, and display model
			const enrichedSessions: EnrichedActiveSession[] = await Promise.all(
				activeSessions.map((session) => enrichSession(session, config.claudeDir, pricing))
			);

			return {
				activeSessions: enrichedSessions,
				events,
				refreshInterval: config.refreshInterval,
				liveRefreshInterval: LIVE_REFRESH_INTERVAL_MS
			};
		}
	);
};
