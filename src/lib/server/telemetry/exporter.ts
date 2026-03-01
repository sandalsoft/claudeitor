import { ExportResultCode } from '@opentelemetry/core';
import type { ExportResult } from '@opentelemetry/core';
import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { getFileWriter } from './writer.js';

function hrTimeToMs(hrTime: [number, number]): number {
	return hrTime[0] * 1000 + hrTime[1] / 1_000_000;
}

function spanToRecord(span: ReadableSpan): Record<string, unknown> {
	const events = span.events.map((event) => ({
		name: event.name,
		time: hrTimeToMs(event.time),
		attributes: event.attributes ?? {}
	}));

	const parentSpanId = span.parentSpanContext?.spanId ?? '';

	return {
		recordType: 'span',
		traceId: span.spanContext().traceId,
		spanId: span.spanContext().spanId,
		parentSpanId,
		name: span.name,
		startTime: hrTimeToMs(span.startTime),
		endTime: hrTimeToMs(span.endTime),
		status: { code: span.status.code, message: span.status.message },
		attributes: span.attributes,
		events,
		resource: {
			'service.name': span.resource.attributes['service.name'],
			'service.version': span.resource.attributes['service.version']
		}
	};
}

export class JSONLSpanExporter implements SpanExporter {
	private writer = getFileWriter();
	private shutdownOnce = false;

	export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
		const promises = spans.map((span) => {
			const record = spanToRecord(span);
			return this.writer.append(record);
		});

		Promise.all(promises)
			.then(() => resultCallback({ code: ExportResultCode.SUCCESS }))
			.catch(() => resultCallback({ code: ExportResultCode.FAILED }));
	}

	shutdown(): Promise<void> {
		if (this.shutdownOnce) return Promise.resolve();
		this.shutdownOnce = true;
		return Promise.resolve();
	}
}
