import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { JSONLSpanExporter } from './exporter.js';
import { setLoggerResource } from './logger.js';

declare global {
	// eslint-disable-next-line no-var
	var __claudeitorTelemetry: boolean | undefined;
}

function getServiceVersion(): string {
	if (process.env.npm_package_version) {
		return process.env.npm_package_version;
	}

	try {
		const pkgPath = join(process.cwd(), 'package.json');
		const raw = readFileSync(pkgPath, 'utf-8');
		return JSON.parse(raw).version ?? 'unknown';
	} catch {
		return 'unknown';
	}
}

function initTelemetry(): void {
	if (globalThis.__claudeitorTelemetry) {
		return;
	}
	globalThis.__claudeitorTelemetry = true;

	const serviceName = 'claudeitor';
	const serviceVersion = getServiceVersion();

	// Set resource on logger so log records include service info
	setLoggerResource(serviceName, serviceVersion);

	const resource = resourceFromAttributes({
		'service.name': serviceName,
		'service.version': serviceVersion
	});

	const exporter = new JSONLSpanExporter();

	const processor = new BatchSpanProcessor(exporter, {
		maxQueueSize: 2048,
		maxExportBatchSize: 512,
		scheduledDelayMillis: 5000
	});

	const provider = new NodeTracerProvider({
		resource,
		spanProcessors: [processor]
	});

	const contextManager = new AsyncLocalStorageContextManager().enable();
	provider.register({ contextManager });
}

// Execute initialization immediately on import
initTelemetry();
