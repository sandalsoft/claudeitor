/**
 * Lightweight fuzzy search for the command palette.
 * No external dependencies -- simple substring scoring with character-gap penalty.
 */

export interface FuzzyResult<T> {
	item: T;
	score: number;
}

/**
 * Score a query against a target string.
 * Returns a number 0-1 (1 = perfect match), or -1 if no match.
 *
 * Algorithm:
 *   - Walk query chars in order through target chars
 *   - Consecutive matches score higher (bonus)
 *   - Earlier matches score higher
 *   - Exact substring match scores highest
 */
export function fuzzyScore(query: string, target: string): number {
	const q = query.toLowerCase();
	const t = target.toLowerCase();

	if (q.length === 0) return 1; // empty query matches everything
	if (q.length > t.length) return -1;

	// Fast path: exact substring
	const substringIdx = t.indexOf(q);
	if (substringIdx !== -1) {
		// Score higher for matches near the start
		return 1 - substringIdx * 0.01;
	}

	// Character-by-character fuzzy walk
	let qi = 0;
	let consecutiveBonus = 0;
	let score = 0;
	let lastMatchIdx = -2;

	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] === q[qi]) {
			// Consecutive match bonus
			if (ti === lastMatchIdx + 1) {
				consecutiveBonus += 0.1;
			} else {
				consecutiveBonus = 0;
			}

			// Position bonus: earlier matches score higher
			const positionScore = 1 - ti / t.length;
			score += positionScore * 0.3 + 0.1 + consecutiveBonus;

			lastMatchIdx = ti;
			qi++;
		}
	}

	// All query chars must be found
	if (qi < q.length) return -1;

	// Normalize by query length to keep scores comparable
	return Math.min(score / q.length, 0.99);
}

/**
 * Filter and rank items by fuzzy match against a text extractor.
 */
export function fuzzyFilter<T>(
	items: T[],
	query: string,
	getText: (item: T) => string
): FuzzyResult<T>[] {
	if (query.trim().length === 0) return items.map((item) => ({ item, score: 1 }));

	const results: FuzzyResult<T>[] = [];
	for (const item of items) {
		const score = fuzzyScore(query, getText(item));
		if (score > 0) {
			results.push({ item, score });
		}
	}

	results.sort((a, b) => b.score - a.score);
	return results;
}
