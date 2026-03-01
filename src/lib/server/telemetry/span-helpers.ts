import { trace, SpanStatusCode, type Span, type Attributes } from '@opentelemetry/api';

const TRACER_NAME = 'claudeitor';

function getTracer() {
	return trace.getTracer(TRACER_NAME);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
	return value != null && typeof (value as PromiseLike<unknown>).then === 'function';
}

/**
 * Execute a function within an active span. Preserves sync/async return types:
 * - If `fn` returns a Promise, the span ends in `.finally()`
 * - If `fn` returns synchronously, the span ends synchronously
 *
 * On error: sets span status to ERROR(2) and records the exception.
 */
export function withSpan<T>(
	name: string,
	attrs: Attributes,
	fn: (span: Span) => T
): T {
	return getTracer().startActiveSpan(name, { attributes: attrs }, (span: Span) => {
		try {
			const result = fn(span);

			// Detect async: if result is a thenable, handle async lifecycle
			if (isPromiseLike(result)) {
				const promise = Promise.resolve(result as unknown)
					.catch((err: unknown) => {
						span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
						span.recordException(err instanceof Error ? err : new Error(String(err)));
						throw err;
					})
					.finally(() => {
						span.end();
					});
				return promise as T;
			}

			// Sync path: end span immediately
			span.end();
			return result;
		} catch (err) {
			span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
			span.recordException(err instanceof Error ? err : new Error(String(err)));
			span.end();
			throw err;
		}
	});
}
