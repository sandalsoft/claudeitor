// Git repository scanning types

export interface RepoCommit {
	hash: string;
	subject: string;
	authorName: string;
	authorEmail: string;
	date: string; // ISO 8601
}

export interface RepoInfo {
	path: string;
	name: string;
	branch: string;
	headHash: string;
	commits: RepoCommit[];
	uncommittedFileCount: number;
	unpushedCommitCount: number;
	lastFetched: number; // timestamp ms
}

export interface GitScanResult {
	repos: RepoInfo[];
	errors: string[];
}
