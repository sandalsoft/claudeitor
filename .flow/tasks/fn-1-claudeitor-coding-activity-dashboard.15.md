# fn-1-claudeitor-coding-activity-dashboard.15 Write Vitest unit tests for data layer

## Description
Write Vitest unit tests for the entire data layer: Claude data readers, git scanner, config reader, cost calculator, model ID mapping, and utility functions. Tests should cover happy paths, error handling (missing files, malformed data), and edge cases.

**Size:** M
**Files:** src/lib/data/claude/__tests__/stats.test.ts, src/lib/data/claude/__tests__/costs.test.ts, src/lib/data/claude/__tests__/sessions.test.ts, src/lib/data/claude/__tests__/model-mapping.test.ts, src/lib/data/claude/__tests__/cost-calculator.test.ts, src/lib/data/git/__tests__/scanner.test.ts, src/lib/data/__tests__/config.test.ts, src/lib/utils/__tests__/chart-helpers.test.ts

## Approach
- Use Vitest with vi.mock for filesystem operations (do NOT read real ~/.claude/ in tests)
- Mock fs.readFile to return test fixtures
- Test fixtures: sample stats-cache.json, readout-cost-cache.json, readout-pricing.json, history.jsonl
- Test categories per module:
  - Stats reader: valid data, missing file, malformed JSON, missing fields
  - Cost reader: valid data, missing file, empty days
  - Session reader: valid JSONL, empty file, malformed lines
  - Model mapping: known models, unknown models, edge case IDs
  - Cost calculator: correct math, missing models in pricing, empty data
  - Git scanner: mock child_process.exec for git commands
  - Config reader: valid config, missing file, tilde expansion
  - Chart helpers: formatCurrency, formatNumber, date formatting

## Key context
- Vitest config should be in vitest.config.ts or vite.config.ts
- Use vi.mock('fs/promises') for filesystem mocking
- Test fixtures should use realistic data matching actual ~/.claude/ schemas
- Focus on data correctness — UI components tested separately
## Acceptance
- [ ] Vitest configured and `pnpm test` runs all tests
- [ ] Stats reader tests: valid data, missing file, malformed JSON
- [ ] Cost reader tests: valid data, missing file, empty days
- [ ] Session reader tests: valid JSONL, empty file, malformed lines
- [ ] Model mapping tests: known models, unknown models, edge cases
- [ ] Cost calculator tests: correct math with known pricing, missing models
- [ ] Git scanner tests: mock git commands, handle errors
- [ ] Config reader tests: valid config, missing file, tilde expansion
- [ ] Chart helper tests: formatting functions
- [ ] All tests use mocked filesystem (no real ~/.claude/ reads)
- [ ] Test fixtures match actual data schemas
- [ ] All tests pass with `pnpm test`
## Done summary
Comprehensive Vitest unit tests for the entire data layer: 97 tests across 6 test files covering stats reader, cost reader, pricing reader, session history, settings, skills, agents, model ID mapping, cost calculator, git scanner, config reader (read/write/expandTilde/defaults), and chart helper formatting functions. All tests use temp fixture directories (no real ~/.claude/ reads), cover happy paths, malformed JSON, missing files, empty data, and edge cases.
## Evidence
- Commits: 5f795b4, d3892a2
- Tests: pnpm test
- PRs: