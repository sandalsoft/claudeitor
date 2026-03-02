import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import {
	discoverRepos,
	getRepoInfo,
	scanRepos,
	getCommitsToday,
	clearCommitCache,
	isGitAvailable
} from './scanner.js';

let fixtureDir: string;
let repoA: string;
let repoB: string;
let nonGitDir: string;

function git(cwd: string, cmd: string): string {
	return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8' }).trim();
}

beforeAll(async () => {
	fixtureDir = await mkdtemp(join(tmpdir(), 'claudeitor-git-test-'));

	// Create repo A with commits
	repoA = join(fixtureDir, 'repo-a');
	await mkdir(repoA, { recursive: true });
	git(repoA, 'init');
	git(repoA, 'config user.email "test@test.com"');
	git(repoA, 'config user.name "Test User"');
	await writeFile(join(repoA, 'file.txt'), 'hello');
	git(repoA, 'add .');
	git(repoA, 'commit -m "initial commit"');

	// Create repo B (nested inside a parent dir)
	const parentDir = join(fixtureDir, 'projects');
	await mkdir(parentDir, { recursive: true });
	repoB = join(parentDir, 'repo-b');
	await mkdir(repoB, { recursive: true });
	git(repoB, 'init');
	git(repoB, 'config user.email "test@test.com"');
	git(repoB, 'config user.name "Test User"');
	await writeFile(join(repoB, 'main.ts'), 'console.log("hi")');
	git(repoB, 'add .');
	git(repoB, 'commit -m "first commit"');

	// Create a non-git directory
	nonGitDir = join(fixtureDir, 'not-a-repo');
	await mkdir(nonGitDir, { recursive: true });
	await writeFile(join(nonGitDir, 'readme.txt'), 'no git here');
});

afterAll(async () => {
	await rm(fixtureDir, { recursive: true, force: true });
});

beforeEach(() => {
	clearCommitCache();
});

describe('isGitAvailable', () => {
	it('returns true when git is installed', async () => {
		expect(await isGitAvailable()).toBe(true);
	});
});

describe('discoverRepos', () => {
	it('discovers a direct git repo', async () => {
		const repos = await discoverRepos([repoA]);
		expect(repos).toContain(repoA);
	});

	it('discovers nested git repos', async () => {
		const repos = await discoverRepos([fixtureDir]);
		expect(repos).toContain(repoA);
		expect(repos).toContain(repoB);
	});

	it('does not include non-git directories', async () => {
		const repos = await discoverRepos([fixtureDir]);
		expect(repos).not.toContain(nonGitDir);
	});

	it('handles non-existent directories gracefully', async () => {
		const repos = await discoverRepos(['/nonexistent/path']);
		expect(repos).toEqual([]);
	});
});

describe('getRepoInfo', () => {
	it('returns info for a valid repo', async () => {
		const info = await getRepoInfo(repoA);
		expect(info).not.toBeNull();
		expect(info!.name).toBe('repo-a');
		expect(info!.path).toBe(repoA);
		expect(info!.branch).toBeDefined();
		expect(info!.headHash).toMatch(/^[0-9a-f]{40}$/);
		expect(info!.commits).toHaveLength(1);
		expect(info!.commits[0].subject).toBe('initial commit');
		expect(info!.uncommittedFileCount).toBe(0);
	});

	it('detects uncommitted files', async () => {
		await writeFile(join(repoA, 'new-file.txt'), 'uncommitted');
		const info = await getRepoInfo(repoA);
		expect(info!.uncommittedFileCount).toBeGreaterThan(0);
		// Clean up
		git(repoA, 'checkout -- . 2>/dev/null || true');
		execSync(`rm -f ${join(repoA, 'new-file.txt')}`);
	});

	it('uses commit cache when HEAD unchanged', async () => {
		const info1 = await getRepoInfo(repoA);
		const info2 = await getRepoInfo(repoA);
		// Both should have same data
		expect(info1!.headHash).toBe(info2!.headHash);
		expect(info1!.commits.length).toBe(info2!.commits.length);
	});

	it('refreshes commit cache when HEAD changes', async () => {
		const info1 = await getRepoInfo(repoA);
		const oldHash = info1!.headHash;

		// Make a new commit
		await writeFile(join(repoA, 'another.txt'), 'new content');
		git(repoA, 'add .');
		git(repoA, 'commit -m "second commit"');

		const info2 = await getRepoInfo(repoA);
		expect(info2!.headHash).not.toBe(oldHash);
		expect(info2!.commits.length).toBe(2);
	});

	it('returns null for non-git directory', async () => {
		const info = await getRepoInfo(nonGitDir);
		expect(info).toBeNull();
	});
});

describe('scanRepos', () => {
	it('scans configured directories and returns repo info', async () => {
		const result = await scanRepos([fixtureDir]);
		expect(result.repos.length).toBeGreaterThanOrEqual(2);
		const names = result.repos.map((r) => r.name);
		expect(names).toContain('repo-a');
		expect(names).toContain('repo-b');
		expect(result.errors).toEqual([]);
	});

	it('returns errors array for scan failures', async () => {
		const result = await scanRepos(['/nonexistent/path']);
		expect(result.repos).toEqual([]);
		expect(result.errors).toEqual([]);
	});
});

describe('getCommitsToday', () => {
	it('counts commits from today', async () => {
		const info = await getRepoInfo(repoA);
		const count = getCommitsToday([info!]);
		// Our test commits are from today
		expect(count).toBeGreaterThanOrEqual(1);
	});

	it('returns 0 for empty repo list', () => {
		expect(getCommitsToday([])).toBe(0);
	});
});
