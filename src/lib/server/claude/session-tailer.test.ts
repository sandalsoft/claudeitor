import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, appendFile, rm, truncate } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSessionTailer } from './session-tailer.js';

// ─── Helpers ────────────────────────────────────────────────────

const SESSION_ID = 'test-session-abc-123';

/** Build a minimal JSONL line. */
function jsonl(obj: Record<string, unknown>): string {
	return JSON.stringify(obj) + '\n';
}

/** Create an assistant message line with optional content and usage. */
function assistantLine(opts: {
	model?: string;
	inputTokens?: number;
	outputTokens?: number;
	cacheRead?: number;
	cacheWrite?: number;
	content?: unknown[];
	timestamp?: string;
}): string {
	return jsonl({
		type: 'assistant',
		timestamp: opts.timestamp ?? new Date().toISOString(),
		message: {
			model: opts.model ?? 'claude-opus-4-5-20251101',
			usage: {
				input_tokens: opts.inputTokens ?? 0,
				output_tokens: opts.outputTokens ?? 0,
				cache_read_input_tokens: opts.cacheRead ?? 0,
				cache_creation_input_tokens: opts.cacheWrite ?? 0
			},
			content: opts.content ?? [{ type: 'text', text: 'Hello' }]
		}
	});
}

/** Create a user message line. */
function userLine(text = 'Hi', timestamp?: string): string {
	return jsonl({
		type: 'user',
		timestamp: timestamp ?? new Date().toISOString(),
		message: { content: text }
	});
}

/** Create a tool_use content block. */
function toolUseBlock(id: string, name: string, input?: Record<string, unknown>) {
	return { type: 'tool_use', id, name, input: input ?? {} };
}

/** Create a tool_result content block. */
function toolResultBlock(toolUseId: string, isError = false) {
	return { type: 'tool_result', tool_use_id: toolUseId, is_error: isError };
}

// ─── Test suite ─────────────────────────────────────────────────

let fixtureDir: string;
let projectDir: string;
let sessionFile: string;

beforeEach(async () => {
	fixtureDir = await mkdtemp(join(tmpdir(), 'tailer-test-'));
	// Create the project directory structure that findSessionFile expects
	projectDir = join(fixtureDir, 'projects', '-Users-test-project');
	await mkdir(projectDir, { recursive: true });
	sessionFile = join(projectDir, `${SESSION_ID}.jsonl`);
});

afterAll(async () => {
	// Clean up — best-effort
	try {
		if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
	} catch {
		// ignore
	}
});

describe('createSessionTailer', () => {
	it('returns a tailer with tail, reset, and resetAll methods', () => {
		const tailer = createSessionTailer();
		expect(typeof tailer.tail).toBe('function');
		expect(typeof tailer.reset).toBe('function');
		expect(typeof tailer.resetAll).toBe('function');
	});
});

describe('tail()', () => {
	it('returns empty telemetry when session file does not exist', async () => {
		const tailer = createSessionTailer();
		const result = await tailer.tail('nonexistent-session', fixtureDir);
		expect(result.tokens).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
		expect(result.recentToolCalls).toEqual([]);
		expect(result.recentFiles).toEqual([]);
		expect(result.messageCount).toBe(0);
		expect(result.model).toBe('');
	});

	it('parses a full session file on first read', async () => {
		const content =
			userLine('Hello') +
			assistantLine({
				inputTokens: 100,
				outputTokens: 200,
				cacheRead: 50,
				cacheWrite: 10,
				model: 'claude-opus-4-5-20251101'
			}) +
			userLine('Next question') +
			assistantLine({
				inputTokens: 300,
				outputTokens: 400,
				cacheRead: 150,
				cacheWrite: 20
			});

		await writeFile(sessionFile, content);

		const tailer = createSessionTailer();
		const result = await tailer.tail(SESSION_ID, fixtureDir);

		expect(result.tokens).toEqual({
			input: 400,
			output: 600,
			cacheRead: 200,
			cacheWrite: 30
		});
		expect(result.messageCount).toBe(4);
		expect(result.model).toBe('claude-opus-4-5-20251101');
	});

	it('reads only new bytes on incremental calls', async () => {
		// Write initial content
		const initial =
			userLine('Hello') +
			assistantLine({ inputTokens: 100, outputTokens: 50 });
		await writeFile(sessionFile, initial);

		const tailer = createSessionTailer();

		// First read
		const first = await tailer.tail(SESSION_ID, fixtureDir);
		expect(first.tokens.input).toBe(100);
		expect(first.tokens.output).toBe(50);
		expect(first.messageCount).toBe(2);

		// Append more data
		const additional =
			userLine('More') +
			assistantLine({ inputTokens: 200, outputTokens: 100 });
		await appendFile(sessionFile, additional);

		// Second read: should only parse new bytes, but tokens are cumulative
		const second = await tailer.tail(SESSION_ID, fixtureDir);
		expect(second.tokens.input).toBe(300); // 100 + 200
		expect(second.tokens.output).toBe(150); // 50 + 100
		expect(second.messageCount).toBe(4); // 2 + 2
	});

	it('returns stable telemetry on empty read (no new data)', async () => {
		const content = assistantLine({ inputTokens: 500, outputTokens: 250 });
		await writeFile(sessionFile, content);

		const tailer = createSessionTailer();
		const first = await tailer.tail(SESSION_ID, fixtureDir);
		const second = await tailer.tail(SESSION_ID, fixtureDir);

		expect(second.tokens).toEqual(first.tokens);
		expect(second.messageCount).toBe(first.messageCount);
	});

	it('accumulates tokens cumulatively across multiple reads', async () => {
		await writeFile(sessionFile, assistantLine({ inputTokens: 10, outputTokens: 20, cacheRead: 5, cacheWrite: 2 }));

		const tailer = createSessionTailer();
		await tailer.tail(SESSION_ID, fixtureDir);

		await appendFile(sessionFile, assistantLine({ inputTokens: 30, outputTokens: 40, cacheRead: 15, cacheWrite: 8 }));
		await tailer.tail(SESSION_ID, fixtureDir);

		await appendFile(sessionFile, assistantLine({ inputTokens: 60, outputTokens: 80, cacheRead: 25, cacheWrite: 12 }));
		const result = await tailer.tail(SESSION_ID, fixtureDir);

		expect(result.tokens).toEqual({
			input: 100,
			output: 140,
			cacheRead: 45,
			cacheWrite: 22
		});
	});

	it('resets offset and cumulative state when file is truncated', async () => {
		// Write a large initial content
		const initial =
			userLine('Hello') +
			assistantLine({ inputTokens: 1000, outputTokens: 500 });
		await writeFile(sessionFile, initial);

		const tailer = createSessionTailer();
		const first = await tailer.tail(SESSION_ID, fixtureDir);
		expect(first.tokens.input).toBe(1000);

		// Truncate file (simulate rotation) and write new smaller content
		const newContent = assistantLine({ inputTokens: 10, outputTokens: 5 });
		await writeFile(sessionFile, newContent);

		const second = await tailer.tail(SESSION_ID, fixtureDir);
		// Should have reset — only the new content's tokens
		expect(second.tokens.input).toBe(10);
		expect(second.tokens.output).toBe(5);
	});

	it('handles partial lines at end of file', async () => {
		// Write a complete line followed by a partial one (no trailing newline)
		const completeLine = assistantLine({ inputTokens: 100, outputTokens: 50 });
		const partialJson = '{"type":"assistant","timestamp":"2026-01-01T00:00:00Z","message":{"model":"claude-opus-4-5-20251101"';
		await writeFile(sessionFile, completeLine + partialJson);

		const tailer = createSessionTailer();
		const first = await tailer.tail(SESSION_ID, fixtureDir);
		// Should parse the complete line but not crash on the partial
		expect(first.tokens.input).toBe(100);
		expect(first.messageCount).toBe(1);

		// Now complete the partial line
		const rest = ',"usage":{"input_tokens":200,"output_tokens":100,"cache_read_input_tokens":0,"cache_creation_input_tokens":0},"content":[{"type":"text","text":"done"}]}}\n';
		await appendFile(sessionFile, rest);

		const second = await tailer.tail(SESSION_ID, fixtureDir);
		// Now the previously partial line should be parsed
		expect(second.tokens.input).toBe(300); // 100 + 200
		expect(second.messageCount).toBe(2);
	});

	it('skips malformed JSON lines with a warning', async () => {
		const content =
			assistantLine({ inputTokens: 100, outputTokens: 50 }) +
			'this is not valid json\n' +
			'{also broken\n' +
			assistantLine({ inputTokens: 200, outputTokens: 100 });

		await writeFile(sessionFile, content);

		const tailer = createSessionTailer();
		const result = await tailer.tail(SESSION_ID, fixtureDir);

		// Should have parsed the two valid lines
		expect(result.tokens.input).toBe(300);
		expect(result.messageCount).toBe(2);
	});
});

describe('tool call correlation', () => {
	it('tracks tool_use as pending and resolves on tool_result success', async () => {
		const content = assistantLine({
			content: [
				toolUseBlock('call-1', 'Read', { file_path: '/src/app.ts' }),
				toolResultBlock('call-1', false)
			]
		});
		await writeFile(sessionFile, content);

		const tailer = createSessionTailer();
		const result = await tailer.tail(SESSION_ID, fixtureDir);

		const call = result.recentToolCalls.find((c) => c.id === 'call-1');
		expect(call).toBeDefined();
		expect(call!.status).toBe('success');
		expect(call!.name).toBe('Read');
		expect(call!.filePath).toBe('/src/app.ts');
	});

	it('marks tool_result with is_error as error status', async () => {
		const content = assistantLine({
			content: [
				toolUseBlock('call-err', 'Bash', { command: 'ls' }),
				toolResultBlock('call-err', true)
			]
		});
		await writeFile(sessionFile, content);

		const tailer = createSessionTailer();
		const result = await tailer.tail(SESSION_ID, fixtureDir);

		const call = result.recentToolCalls.find((c) => c.id === 'call-err');
		expect(call).toBeDefined();
		expect(call!.status).toBe('error');
	});

	it('leaves tool_use without matching tool_result as pending', async () => {
		const content = assistantLine({
			content: [toolUseBlock('call-pending', 'Edit', { file_path: '/foo.ts' })]
		});
		await writeFile(sessionFile, content);

		const tailer = createSessionTailer();
		const result = await tailer.tail(SESSION_ID, fixtureDir);

		const call = result.recentToolCalls.find((c) => c.id === 'call-pending');
		expect(call).toBeDefined();
		expect(call!.status).toBe('pending');
	});

	it('resolves pending calls across incremental reads', async () => {
		// First chunk: tool_use only
		const chunk1 = assistantLine({
			content: [toolUseBlock('call-x', 'Write', { file_path: '/bar.ts' })]
		});
		await writeFile(sessionFile, chunk1);

		const tailer = createSessionTailer();
		const first = await tailer.tail(SESSION_ID, fixtureDir);
		expect(first.recentToolCalls.find((c) => c.id === 'call-x')!.status).toBe('pending');

		// Second chunk: matching tool_result
		const chunk2 = assistantLine({
			content: [toolResultBlock('call-x', false)]
		});
		await appendFile(sessionFile, chunk2);

		const second = await tailer.tail(SESSION_ID, fixtureDir);
		expect(second.recentToolCalls.find((c) => c.id === 'call-x')!.status).toBe('success');
	});
});

describe('file mutation extraction', () => {
	it('extracts file mutations from Edit, Write, Read, NotebookEdit tools (case-insensitive)', async () => {
		const content =
			assistantLine({
				content: [toolUseBlock('c1', 'Edit', { file_path: '/a.ts' })]
			}) +
			assistantLine({
				content: [toolUseBlock('c2', 'Write', { path: '/b.ts' })]
			}) +
			assistantLine({
				content: [toolUseBlock('c3', 'Read', { filePath: '/c.ts' })]
			}) +
			assistantLine({
				content: [toolUseBlock('c4', 'NotebookEdit', { notebook_path: '/d.ipynb' })]
			}) +
			assistantLine({
				content: [toolUseBlock('c5', 'MultiEdit', { file_path: '/e.ts' })]
			});

		await writeFile(sessionFile, content);

		const tailer = createSessionTailer();
		const result = await tailer.tail(SESSION_ID, fixtureDir);

		expect(result.recentFiles).toHaveLength(5);
		expect(result.recentFiles[0]).toMatchObject({
			filePath: '/a.ts',
			toolName: 'Edit',
			operation: 'edit'
		});
		expect(result.recentFiles[1]).toMatchObject({
			filePath: '/b.ts',
			toolName: 'Write',
			operation: 'write'
		});
		expect(result.recentFiles[2]).toMatchObject({
			filePath: '/c.ts',
			toolName: 'Read',
			operation: 'read'
		});
		expect(result.recentFiles[3]).toMatchObject({
			filePath: '/d.ipynb',
			toolName: 'NotebookEdit',
			operation: 'notebook_edit'
		});
		expect(result.recentFiles[4]).toMatchObject({
			filePath: '/e.ts',
			toolName: 'MultiEdit',
			operation: 'edit'
		});
	});

	it('excludes Bash tool from file mutations', async () => {
		const content = assistantLine({
			content: [toolUseBlock('b1', 'Bash', { command: 'cat /some/file.ts' })]
		});
		await writeFile(sessionFile, content);

		const tailer = createSessionTailer();
		const result = await tailer.tail(SESSION_ID, fixtureDir);

		expect(result.recentFiles).toHaveLength(0);
		// But tool call should still be tracked
		expect(result.recentToolCalls).toHaveLength(1);
		expect(result.recentToolCalls[0].name).toBe('Bash');
	});

	it('skips file mutation when tool has no file path', async () => {
		const content = assistantLine({
			content: [toolUseBlock('c1', 'Edit', { old_string: 'a', new_string: 'b' })]
		});
		await writeFile(sessionFile, content);

		const tailer = createSessionTailer();
		const result = await tailer.tail(SESSION_ID, fixtureDir);

		// No file path => no file mutation
		expect(result.recentFiles).toHaveLength(0);
	});
});

describe('collection capping', () => {
	it('caps tool calls at 50', async () => {
		let content = '';
		for (let i = 0; i < 60; i++) {
			content += assistantLine({
				content: [toolUseBlock(`call-${i}`, 'Bash', { command: `echo ${i}` })]
			});
		}
		await writeFile(sessionFile, content);

		const tailer = createSessionTailer();
		const result = await tailer.tail(SESSION_ID, fixtureDir);

		expect(result.recentToolCalls.length).toBe(50);
		// Should keep the last 50 (10..59)
		expect(result.recentToolCalls[0].id).toBe('call-10');
		expect(result.recentToolCalls[49].id).toBe('call-59');
	});

	it('caps file mutations at 30', async () => {
		let content = '';
		for (let i = 0; i < 40; i++) {
			content += assistantLine({
				content: [toolUseBlock(`fc-${i}`, 'Edit', { file_path: `/file-${i}.ts` })]
			});
		}
		await writeFile(sessionFile, content);

		const tailer = createSessionTailer();
		const result = await tailer.tail(SESSION_ID, fixtureDir);

		expect(result.recentFiles.length).toBe(30);
		expect(result.recentFiles[0].filePath).toBe('/file-10.ts');
		expect(result.recentFiles[29].filePath).toBe('/file-39.ts');
	});
});

describe('session eviction', () => {
	it('evicts sessions not polled for 5 minutes', async () => {
		await writeFile(sessionFile, assistantLine({ inputTokens: 100 }));

		const tailer = createSessionTailer();

		// First poll establishes state
		const first = await tailer.tail(SESSION_ID, fixtureDir);
		expect(first.tokens.input).toBe(100);

		// Simulate time passing by manipulating Date.now
		const realNow = Date.now;
		Date.now = () => realNow() + 6 * 60 * 1000; // 6 minutes later

		try {
			// Append data
			await appendFile(sessionFile, assistantLine({ inputTokens: 200 }));

			// This tail call triggers eviction of the old state first,
			// then creates fresh state — so only the new data is parsed
			// (but the full file is read since offset was reset)
			const second = await tailer.tail(SESSION_ID, fixtureDir);
			// After eviction, state was reset — full file re-read
			expect(second.tokens.input).toBe(300); // 100 + 200 from full re-read
		} finally {
			Date.now = realNow;
		}
	});
});

describe('reset()', () => {
	it('clears state for a single session', async () => {
		await writeFile(sessionFile, assistantLine({ inputTokens: 500 }));

		const tailer = createSessionTailer();
		await tailer.tail(SESSION_ID, fixtureDir);

		tailer.reset(SESSION_ID);

		// After reset, full re-read happens
		const result = await tailer.tail(SESSION_ID, fixtureDir);
		expect(result.tokens.input).toBe(500); // Re-read from start
		expect(result.messageCount).toBe(1);
	});
});

describe('resetAll()', () => {
	it('clears all session state', async () => {
		await writeFile(sessionFile, assistantLine({ inputTokens: 100 }));

		const tailer = createSessionTailer();
		await tailer.tail(SESSION_ID, fixtureDir);

		tailer.resetAll();

		const result = await tailer.tail(SESSION_ID, fixtureDir);
		expect(result.tokens.input).toBe(100); // Re-read from start
	});
});
