import type { PageServerLoad, Actions } from './$types';
import { error } from '@sveltejs/kit';
import { readConfig } from '$lib/server/config';
import {
	readSessionDetail,
	readCachedSummary,
	cacheSummary,
	type AISummary
} from '$lib/server/claude/session-detail';
import { withSpan } from '$lib/server/telemetry/span-helpers';

export const load: PageServerLoad = async ({ params }) => {
	return withSpan(
		'load:session-detail',
		{
			'code.filepath': 'src/routes/sessions/[id]/+page.server.ts',
			'http.route': '/sessions/[id]'
		},
		async () => {
			const config = await readConfig();
			const sessionId = params.id;

			const detail = await readSessionDetail(sessionId, config.claudeDir);
			if (!detail) {
				error(404, `Session "${sessionId}" not found`);
			}

			// Check for cached AI summary
			const cachedSummary = await readCachedSummary(sessionId, config.claudeDir);

			return {
				detail,
				cachedSummary,
				hasApiKey: config.anthropicApiKey.length > 0
			};
		}
	);
};

export const actions: Actions = {
	/**
	 * Generate an AI summary for the session via Anthropic API.
	 * The API key is server-only -- never exposed to the client.
	 */
	summarize: async ({ params, request }) => {
		const config = await readConfig();

		if (!config.anthropicApiKey) {
			return { success: false, error: 'No API key configured' };
		}

		const sessionId = params.id;
		const detail = await readSessionDetail(sessionId, config.claudeDir);
		if (!detail) {
			return { success: false, error: 'Session not found' };
		}

		// Check cache first
		const cached = await readCachedSummary(sessionId, config.claudeDir);
		if (cached) {
			return { success: true, summary: cached };
		}

		// Build a concise transcript for the AI
		const transcript = detail.messages
			.filter((m) => m.text.trim())
			.map((m) => {
				const role = m.role === 'user' ? 'User' : 'Assistant';
				// Truncate very long messages to keep prompt manageable
				const text = m.text.length > 2000 ? m.text.slice(0, 2000) + '...' : m.text;
				return `[${role}] ${text}`;
			})
			.slice(0, 50) // Cap at 50 messages to avoid token overruns
			.join('\n\n');

		try {
			const Anthropic = (await import('@anthropic-ai/sdk')).default;
			const client = new Anthropic({ apiKey: config.anthropicApiKey });

			const response = await client.messages.create({
				model: config.aiModel,
				max_tokens: 500,
				messages: [
					{
						role: 'user',
						content: `Summarize this Claude Code coding session in 2-3 concise sentences. Focus on what was accomplished, the main technologies/files involved, and the outcome.\n\nSession transcript:\n${transcript}`
					}
				]
			});

			const summaryText = response.content
				.filter((b) => b.type === 'text')
				.map((b) => b.text)
				.join('\n');

			const summary: AISummary = {
				summary: summaryText,
				generatedAt: new Date().toISOString(),
				model: config.aiModel
			};

			// Cache the result
			await cacheSummary(sessionId, summary, config.claudeDir);

			return { success: true, summary };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			console.warn('[session-summary] AI summary generation failed:', message);
			return { success: false, error: `Failed to generate summary: ${message}` };
		}
	}
};
