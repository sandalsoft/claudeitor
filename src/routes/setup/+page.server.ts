import { stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import type { PageServerLoad } from './$types';
import { readConfig } from '$lib/server/config';
import { readSkills } from '$lib/server/claude/skills';
import { readSettings } from '$lib/server/claude/settings';
import type { SetupCheck, SetupStatus } from '$lib/data/types';
import { withSpan } from '$lib/server/telemetry/span-helpers';
import { warn } from '$lib/server/telemetry/logger';

function check(label: string, status: SetupStatus, detail: string): SetupCheck {
	return { label, status, detail };
}

/** Check if a file/directory exists via stat. */
async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

/** Resolve `which claude` with a timeout. Guards against double-resolve. */
function whichClaude(): Promise<boolean> {
	return new Promise((resolve) => {
		let resolved = false;
		const settle = (value: boolean) => {
			if (!resolved) {
				resolved = true;
				resolve(value);
			}
		};
		const child = execFile('which', ['claude'], { timeout: 2000 }, (err) => {
			settle(!err);
		});
		child.once('error', () => settle(false));
	});
}

export const load: PageServerLoad = async () => {
	return withSpan(
		'load:setup',
		{
			'code.filepath': 'src/routes/setup/+page.server.ts',
			'http.route': '/setup'
		},
		async () => {
			const config = await readConfig();
			const checks: SetupCheck[] = [];

			// 1. claude CLI
			const cliFound = await whichClaude();
			checks.push(
				check(
					'Claude CLI',
					cliFound ? 'ok' : 'error',
					cliFound ? 'Found on PATH' : 'Not found (run: npm i -g @anthropic-ai/claude-code)'
				)
			);

			// 2. Claude directory
			const claudeDirExists = await exists(config.claudeDir);
			checks.push(
				check(
					'Claude directory',
					claudeDirExists ? 'ok' : 'error',
					claudeDirExists ? config.claudeDir : `Missing: ${config.claudeDir}`
				)
			);

			// 3. Config file (3-state: missing / malformed / valid)
			const configFilePath = join(process.cwd(), 'claudeitor.config.json');
			let configStatus: SetupStatus = 'error';
			let configDetail = 'Missing';
			try {
				const raw = await readFile(configFilePath, 'utf-8');
				try {
					JSON.parse(raw);
					configStatus = 'ok';
					configDetail = 'Valid';
				} catch {
					configStatus = 'warn';
					configDetail = 'Present but malformed JSON';
				}
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
					configStatus = 'warn';
					configDetail = 'Missing (using defaults)';
				} else {
					warn('setup', 'Error reading config file', {
						'error.type': (err as Error).name
					});
					configStatus = 'error';
					configDetail = 'Unreadable';
				}
			}
			checks.push(check('Config file', configStatus, configDetail));

			// 4. repoDirs configured
			const hasRepoDirs = config.repoDirs.length > 0;
			checks.push(
				check(
					'Repository directories',
					hasRepoDirs ? 'ok' : 'warn',
					hasRepoDirs
						? `${config.repoDirs.length} configured`
						: 'None configured (add repoDirs to config)'
				)
			);

			// 5. API key
			const hasApiKey = config.anthropicApiKey.length > 0;
			checks.push(
				check(
					'API key',
					hasApiKey ? 'ok' : 'warn',
					hasApiKey ? 'Configured' : 'Not set (optional, for AI features)'
				)
			);

			// 6. CLAUDE.md files
			const globalClaudeMd = await exists(join(config.claudeDir, 'CLAUDE.md'));
			const projectClaudeMd = await exists(join(process.cwd(), 'CLAUDE.md'));
			const claudeMdStatus: SetupStatus =
				globalClaudeMd || projectClaudeMd ? 'ok' : 'warn';
			const claudeMdParts: string[] = [];
			if (globalClaudeMd) claudeMdParts.push('global');
			if (projectClaudeMd) claudeMdParts.push('project');
			checks.push(
				check(
					'CLAUDE.md',
					claudeMdStatus,
					claudeMdParts.length > 0
						? `Found: ${claudeMdParts.join(', ')}`
						: 'Not found (optional)'
				)
			);

			// 7. Skills
			const skills = await readSkills(config.claudeDir);
			checks.push(
				check(
					'Skills',
					skills.length > 0 ? 'ok' : 'warn',
					skills.length > 0
						? `${skills.length} skill${skills.length === 1 ? '' : 's'}`
						: 'None installed (optional)'
				)
			);

			// 8. Hooks
			const settings = await readSettings(config.claudeDir);
			const hooks =
				settings.hooks && typeof settings.hooks === 'object' && !Array.isArray(settings.hooks)
					? settings.hooks
					: {};
			const hookCount = Object.values(hooks).reduce(
				(sum, matchers) => sum + (Array.isArray(matchers) ? matchers.length : 0),
				0
			);
			checks.push(
				check(
					'Hooks',
					hookCount > 0 ? 'ok' : 'warn',
					hookCount > 0
						? `${hookCount} hook${hookCount === 1 ? '' : 's'} configured`
						: 'None configured (optional)'
				)
			);

			const okCount = checks.filter((c) => c.status === 'ok').length;
			const warnCount = checks.filter((c) => c.status === 'warn').length;
			const errorCount = checks.filter((c) => c.status === 'error').length;

			return {
				checks,
				okCount,
				warnCount,
				errorCount
			};
		}
	);
};
