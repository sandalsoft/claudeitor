import { trace, context } from '@opentelemetry/api';
import { getFileWriter } from './writer.js';

export type SeverityText = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const SEVERITY_NUMBER: Record<SeverityText, number> = {
	DEBUG: 5,
	INFO: 9,
	WARN: 13,
	ERROR: 17
};

let resourceCache: { 'service.name': string; 'service.version': string } | null = null;

function getResource(): { 'service.name': string; 'service.version': string } {
	if (resourceCache) return resourceCache;

	// Will be populated once init runs; fallback until then
	resourceCache = {
		'service.name': 'claudeitor',
		'service.version': 'unknown'
	};
	return resourceCache;
}

export function setLoggerResource(name: string, version: string): void {
	resourceCache = { 'service.name': name, 'service.version': version };
}

function getActiveTraceContext(): { traceId: string; spanId: string } {
	const activeSpan = trace.getSpan(context.active());
	if (activeSpan) {
		const ctx = activeSpan.spanContext();
		return { traceId: ctx.traceId, spanId: ctx.spanId };
	}
	return { traceId: '', spanId: '' };
}

function writeLog(
	severity: SeverityText,
	module: string,
	message: string,
	attributes?: Record<string, unknown>
): void {
	const timestamp = Date.now();
	const { traceId, spanId } = getActiveTraceContext();

	// Console output: [SEVERITY] [module] message
	const consoleMsg = `[${severity}] [${module}] ${message}\n`;
	if (severity === 'ERROR') {
		process.stderr.write(consoleMsg);
	} else {
		process.stdout.write(consoleMsg);
	}

	// JSONL record
	const record: Record<string, unknown> = {
		recordType: 'log',
		timestamp,
		severityNumber: SEVERITY_NUMBER[severity],
		severityText: severity,
		body: message,
		attributes: { module, ...attributes },
		traceId,
		spanId,
		resource: getResource()
	};

	void getFileWriter().append(record);
}

export function debug(module: string, message: string, attributes?: Record<string, unknown>): void {
	writeLog('DEBUG', module, message, attributes);
}

export function info(module: string, message: string, attributes?: Record<string, unknown>): void {
	writeLog('INFO', module, message, attributes);
}

export function warn(module: string, message: string, attributes?: Record<string, unknown>): void {
	writeLog('WARN', module, message, attributes);
}

export function error(
	module: string,
	message: string,
	attributes?: Record<string, unknown>
): void {
	writeLog('ERROR', module, message, attributes);
}
