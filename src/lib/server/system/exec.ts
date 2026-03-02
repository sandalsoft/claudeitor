import { execFile } from 'node:child_process';

/** Result shape for safeExecFile -- always returns, never throws on non-zero exit. */
export interface ExecResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	timedOut: boolean;
}

/**
 * Safe wrapper around execFile that always returns a uniform result.
 * Catches errors from non-zero exit codes and extracts stdout/stderr from the error object.
 *
 * This is critical because npm audit, npm outdated, eslint, and tsc ALL exit non-zero
 * when they successfully find issues. Node's execFile throws on non-zero exit but
 * includes stdout/stderr on the error object.
 */
export function safeExecFile(
	cmd: string,
	args: string[],
	opts: { timeout?: number; cwd?: string } = {}
): Promise<ExecResult> {
	return new Promise((resolve) => {
		execFile(cmd, args, { timeout: opts.timeout ?? 10_000, cwd: opts.cwd }, (err, stdout, stderr) => {
			if (err) {
				const errObj = err as NodeJS.ErrnoException & { code?: string | number; killed?: boolean };
				const timedOut = errObj.killed === true || String(errObj.code) === 'ETIMEDOUT';
				// execFile includes stdout/stderr on error objects
				const errStdout = (err as unknown as { stdout?: string }).stdout ?? stdout ?? '';
				const errStderr = (err as unknown as { stderr?: string }).stderr ?? stderr ?? '';
				const exitCode =
					typeof errObj.code === 'number' ? errObj.code : (err as unknown as { status?: number }).status ?? 1;
				resolve({
					stdout: errStdout,
					stderr: errStderr,
					exitCode,
					timedOut
				});
				return;
			}
			resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 0, timedOut: false });
		});
	});
}
