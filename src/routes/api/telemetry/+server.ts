import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFileWriter } from '$lib/server/telemetry/writer';
import { warn } from '$lib/server/telemetry/logger';

/**
 * POST /api/telemetry
 *
 * Receives client-side telemetry records (errors, navigation, etc.)
 * and writes them to the same JSONL file that server-side OTel uses.
 * svelte-sentinel tails this file to detect and fix issues.
 */

const ALLOWED_RECORD_TYPES = new Set(['log', 'client-error', 'client-navigation']);
const MAX_BODY_SIZE = 8192; // 8 KB per record — generous for error payloads
const MAX_BATCH_SIZE = 20; // max records per batch request

interface ClientRecord {
	recordType: string;
	timestamp: number;
	severityText?: string;
	severityNumber?: number;
	body: string;
	attributes?: Record<string, unknown>;
}

function isValidRecord(r: unknown): r is ClientRecord {
	if (typeof r !== 'object' || r === null) return false;
	const obj = r as Record<string, unknown>;
	return (
		typeof obj.recordType === 'string' &&
		ALLOWED_RECORD_TYPES.has(obj.recordType) &&
		typeof obj.timestamp === 'number' &&
		typeof obj.body === 'string'
	);
}

export const POST: RequestHandler = async ({ request }) => {
	const contentLength = request.headers.get('content-length');
	if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE * MAX_BATCH_SIZE) {
		return json({ error: 'Payload too large' }, { status: 413 });
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	// Accept single record or array of records
	const records = Array.isArray(payload) ? payload : [payload];

	if (records.length > MAX_BATCH_SIZE) {
		return json({ error: `Max ${MAX_BATCH_SIZE} records per request` }, { status: 400 });
	}

	const writer = getFileWriter();
	let written = 0;

	for (const raw of records) {
		if (!isValidRecord(raw)) {
			warn('api/telemetry', 'Dropped invalid client record', { raw: JSON.stringify(raw).slice(0, 200) });
			continue;
		}

		const record: Record<string, unknown> = {
			recordType: raw.recordType,
			timestamp: raw.timestamp,
			severityNumber: raw.severityNumber ?? 17, // default ERROR
			severityText: raw.severityText ?? 'ERROR',
			body: raw.body,
			attributes: {
				'telemetry.source': 'client',
				...(raw.attributes ?? {})
			},
			resource: {
				'service.name': 'claudeitor',
				'service.component': 'browser'
			}
		};

		try {
			await writer.append(record);
			written++;
		} catch (err) {
			warn('api/telemetry', 'Failed to write client record', {
				'error.message': (err as Error).message
			});
		}
	}

	return json({ written });
};
