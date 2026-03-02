# 10x Feature Analysis: Claudeitor

Session 1 | Date: 2026-03-01

## Current Value

Claudeitor is a localhost-only coding activity dashboard for Claude Code power users. It reads from `~/.claude/` cache files, git repos, and session JSONL files to provide: activity analytics (D3.js charts), session replay with AI summaries, cost tracking with multi-strategy model mapping, repository health monitoring, and a timeline view. The svelte-sentinel daemon adds autonomous self-healing by tailing OTel telemetry, detecting errors, and spawning headless `claude -p` fix sessions with verification gates.

**Core users**: Individual developers who live in Claude Code daily and want visibility into their AI-assisted workflow.

**The question**: What would make a Claude Code power user unable to close this tab?

---

## The 10 Features

---

### 1. Live Session Flight Deck

**Scale**: Massive | **Effort**: High | **Score**: :fire:

**What**: A real-time dashboard that shows active Claude Code sessions as they happen. Current model, live token counter ticking up, files being touched, tool calls firing, estimated cost accumulating in real-time. Think airport flight tracker, but for your AI coding copilot.

**Why 10x**: Right now Claudeitor is a rearview mirror. You see what happened *after* sessions end. The flight deck makes it a windshield. Users watching their token count climb in real-time will naturally write tighter prompts, catch runaway sessions, and feel in control of their spend. The emotional shift from "I wonder what that cost" to "I can see exactly what's happening" is transformative.

**How it works**: The `/live` route (currently a placeholder) tails the active session's JSONL file in real-time via SSE. A chokidar watcher on `~/.claude/projects/` detects new session files appearing. The flight deck renders:
- Active session card: model, duration timer, token counter (input/output/cache), rolling cost estimate
- Live file activity: files being Read/Edited/Written with recency indicators
- Tool call feed: streaming list of tool invocations with status (success/error)
- Session health: token burn rate chart (tokens/minute), projected final cost
- Kill switch: button to signal the session (via a sentinel-like mechanism)

**Unlocks**: Real-time cost awareness changes user behavior. Opens the door to session-level budget caps ("alert me if this session exceeds $2").

**Differentiation**: No other Claude Code tool shows live session telemetry. This is only possible because Claudeitor has direct access to the local JSONL files.

---

### 2. Cross-Session Intelligence Engine

**Scale**: Massive | **Effort**: High | **Score**: :fire:

**What**: Analyze patterns across all historical sessions to surface actionable insights about the user's coding habits with Claude. Not vanity metrics, but genuinely useful observations.

**Why 10x**: The data already exists in `~/.claude/`. Every session, every token, every tool call, every file touched, every model used. But today it's just raw history. The intelligence engine transforms it into self-knowledge:

- "Your debugging sessions average 3.2x more tokens than feature-building sessions. Consider describing the bug more precisely upfront."
- "Sessions using Haiku for initial exploration followed by Opus for implementation cost 40% less than using Opus throughout."
- "You're most productive (commits per token) between 2-5pm. Morning sessions use 60% more tokens for similar output."
- "The file `auth.ts` has appeared in 14 sessions this month. Consider refactoring it."
- "`src/lib/server/` is your most expensive directory. 38% of all tokens are spent there."

**How it works**: A background analysis job processes session history, extracts features (duration, token counts, models used, files touched, tool call patterns, time of day, git outcomes), and generates structured insights. Insights are cached and refreshed periodically. The UI shows a feed of cards, each with a finding, the evidence, and a suggested action.

**Unlocks**: Turns Claudeitor from a dashboard into a coach. Users optimize their Claude usage not through guesswork but through data about their own patterns.

---

### 3. Prompt Replay & Session Forking

**Scale**: Medium | **Effort**: Medium | **Score**: :fire:

**What**: From any point in a session replay, fork a new Claude Code session that starts with the same context up to that point. "What if I had said this instead?" becomes a real workflow.

**How it works**: The session detail page gets a "Fork from here" button on each message. Clicking it:
1. Extracts the conversation up to that point from the session JSONL
2. Writes it as a resume-compatible session file
3. Opens a terminal (or copies a `claude --resume` command) pre-loaded with that context

**Why 10x**: Session replay is currently read-only archaeology. Forking makes it an active tool. A developer reviews a session that went sideways, spots the wrong turn at message 12, forks from message 11, and tries a different approach. This is the coding equivalent of save states in video games. Nobody else offers this.

**Unlocks**: Experimentation without fear. A/B testing of prompting strategies with real data. Training material for teams ("here's where the session went wrong, here's the fork that worked").

---

### 4. Cost Forecasting & Budget Guardrails

**Scale**: Medium | **Effort**: Medium | **Score**: :fire:

**What**: Predict future Claude costs based on historical usage patterns. Set daily/weekly/monthly budgets. Get proactive alerts before you exceed them, not after.

**How it works**:
- **Forecasting**: Linear regression + seasonal decomposition on `readout-cost-cache.json` daily data. Shows "At your current rate, March will cost $X" with confidence intervals.
- **Budgets**: New config fields: `dailyBudget`, `weeklyBudget`, `monthlyBudget`. The dashboard shows a budget meter (spent vs. remaining) with color-coded status.
- **Alerts**: When projected spend exceeds budget threshold (70%, 90%, 100%), surface alerts on the dashboard and optionally send a notification.
- **Model advisor**: "Switching to Haiku for your exploration sessions would save ~$X/month based on your last 30 days."

**Why 10x**: Cost anxiety is the #1 concern for Claude Code users. The current costs page is forensic ("you spent $X"). Forecasting + budgets transform it into financial control. The model advisor is especially powerful because it uses the user's own data to make personalized recommendations.

**Unlocks**: Confidence to use Claude more aggressively when under budget. Freelancers can set per-client budgets. Teams can set per-project budgets.

---

### 5. Semantic Session Search

**Scale**: Medium | **Effort**: Medium | **Score**: :fire:

**What**: Full-text and semantic search across all session transcripts. "Find the session where I fixed the race condition in the WebSocket handler" returns the right session instantly.

**How it works**:
- **Indexing**: Background job reads all session JSONL files, extracts message text, and builds a search index (SQLite FTS5 or Orama for in-process search).
- **Keyword search**: Fast full-text search across all session messages.
- **Semantic search**: Use the configured AI model to generate embeddings for session summaries, then find semantically similar sessions. (Paid feature using the user's own API key.)
- **Filters**: by date range, model, project/repo, duration, cost, files touched.
- **Results**: Session cards with highlighted matching snippets, sorted by relevance.

**Why 10x**: With dozens or hundreds of sessions, finding "that session from last week where I..." is currently impossible. You scroll through a list of timestamps and project names hoping to recognize the right one. Search transforms sessions from a chronological list into a searchable knowledge base of everything you've built with Claude.

**Unlocks**: Session history becomes institutional memory. "How did I solve this last time?" has an answer.

---

### 6. Sentinel Mission Control

**Scale**: Medium | **Effort**: Medium | **Score**: :+1:

**What**: A dedicated dashboard page for svelte-sentinel that shows: active fix in progress (with live output), recent detections timeline, fix success/failure history, rate limiter status, circuit breaker state, and audit log browser with filtering.

**How it works**: Sentinel already writes an audit JSONL log. The new `/sentinel` route reads this log and the telemetry file to render:
- **Status banner**: Sentinel running/stopped, mode (active/dry-run), uptime
- **Active fix card**: If a fix is in progress, show the issue being fixed, the Claude session output streaming, the git branch name, elapsed time
- **Detection feed**: Real-time feed of detected issues with severity icons, timestamps, dedup counts
- **Fix history**: Table of past fixes with outcome (merged/reverted/needs-human), duration, attempts, link to git diff
- **Health gauges**: Rate limiter (fixes remaining in window), circuit breaker state (closed/open/half-open), dedup cache size
- **Configuration panel**: View/edit `.sentinelrc.json` and `.sentinelignore` from the UI

**Why 10x**: Right now sentinel is a terminal-only tool. You have to SSH in or keep a terminal tab open. Bringing it into the dashboard makes self-healing visible and controllable. Seeing "Sentinel fixed 3 issues while you were in a meeting" in a polished UI is the moment the product sells itself.

**Unlocks**: Non-terminal users can monitor sentinel. Teams can share a sentinel dashboard URL. Opens the door to multi-project sentinel orchestration.

---

### 7. Weekly Digest Report

**Scale**: Small | **Effort**: Low | **Score**: :fire:

**What**: One-click generation of a polished weekly or monthly report: total sessions, costs, top projects, key accomplishments (from AI summaries), productivity trends, notable commits. Exportable as Markdown.

**How it works**:
- New `/reports` route with date range selector and "Generate Report" button.
- Aggregates: session count, total cost, cost by model, cost by project, hours of Claude usage, files touched, commits made.
- Uses the configured AI model to synthesize session summaries into a cohesive narrative: "This week you focused on migrating the auth system and adding telemetry instrumentation. Key deliverables: ..."
- Renders as a clean, printable page. Copy-as-markdown button for pasting into Slack/Notion/email.

**Why 10x**: Freelancers need this for client billing. Managers need this for status updates. Individual devs need this for personal retrospectives. The effort is low (all data already exists) but the value is disproportionately high because it turns Claudeitor from a monitoring tool into a productivity narrative tool.

**Unlocks**: "What did I accomplish this week?" is answered in one click. Client billing becomes effortless.

---

### 8. Session Diff View

**Scale**: Small | **Effort**: Low | **Score**: :fire:

**What**: For any completed session, show a unified diff of all files that were modified, created, or deleted during the session. A "what changed" summary that's more useful than scrolling through 200 replay messages.

**How it works**:
- The session JSONL already contains Edit tool calls with `old_string` and `new_string`, Write calls with full file content, and Bash calls that may include `git diff` output.
- Extract all file mutations from the session and render them as a standard unified diff view with syntax highlighting.
- Augment with git data: if the session resulted in a commit, pull the actual diff from git for accuracy.
- Show a file tree sidebar with change indicators (added/modified/deleted) and line count changes.

**Why 10x**: Session replay is a conversation view. But often what you care about is "what was the net result?" The diff view answers that instantly. It's the difference between watching a 2-hour cooking show and seeing the final recipe. The data already exists; it just needs a better presentation.

**Unlocks**: Code review of AI-generated changes. "Show me everything Claude changed in this session" for before-merge review.

---

### 9. Productivity Heatmap & Streaks

**Scale**: Small | **Effort**: Low | **Score**: :+1:

**What**: A GitHub-style contribution heatmap showing daily Claude coding intensity over the past year. With streak tracking ("14-day coding streak!"), daily/weekly goals, and drill-down to see what was accomplished on any given day.

**How it works**:
- Data source: `stats-cache.json` already has `dailyActivity` with `messageCount`, `sessionCount`, `toolCallCount` per day.
- Render a 52-week heatmap grid (D3.js) with intensity based on session count or message count.
- Click any day to see: sessions that day, total cost, repos touched, key commits.
- Streak counter: consecutive days with at least 1 session.
- Optional weekly goal setting: "I want to have at least 3 Claude sessions per day" with progress tracking.

**Why 10x**: Developers love streaks and heatmaps (GitHub proved this). It adds an emotional/motivational layer to what's currently a purely analytical tool. The "don't break the streak" psychology drives daily engagement with the dashboard.

**Unlocks**: Gamification of productive AI usage. Visual proof of work for performance reviews.

---

### 10. Context Window Visualizer

**Scale**: Small | **Effort**: Low | **Score**: :+1:

**What**: For each session in replay, show a real-time visualization of the context window filling up. A stacked bar or gauge that shows: system prompt, conversation history, tool results, and remaining capacity. Shows exactly when and why auto-compaction triggered.

**How it works**:
- Session JSONL contains token counts per message (`inputTokens`, `outputTokens`, `cacheReadInputTokens`).
- The context window size is known per model (from `modelUsage.contextWindow` in stats-cache).
- Render a horizontal bar that grows with each message, color-coded by content type (user messages, assistant responses, tool call results, system prompt).
- Mark the point where context was ~80% full and compaction likely occurred.
- Show per-message token cost in the replay margin.

**Why 10x**: Context management is the #1 skill gap for Claude Code users. Most don't understand why Claude "forgets" things or starts making mistakes. The visualizer makes the invisible visible. Seeing "this 50KB file read consumed 30% of your context window" teaches users to be more surgical with their prompts. It's educational and immediately actionable.

**Unlocks**: Users learn context management intuitively. Reduces the #1 source of frustration with Claude Code. Could feed back into the Intelligence Engine to flag "context-wasteful" patterns.

---

## Recommended Priority

### Do Now (Quick wins, disproportionate value)

1. **Session Diff View** (#8) - Data already exists in session JSONLs. Renders the "net result" of any session as a unified diff. Low effort, immediately useful for every session.
2. **Weekly Digest Report** (#7) - All data already aggregated. One new route, one AI call to synthesize. Freelancers will love this tomorrow.
3. **Productivity Heatmap** (#9) - `dailyActivity` data is already there. One D3.js component. GitHub proved this pattern works.

### Do Next (High leverage)

4. **Live Session Flight Deck** (#1) - The placeholder `/live` route is waiting. Chokidar watcher infrastructure already exists. This transforms the product's identity from "analytics" to "mission control."
5. **Cost Forecasting & Budgets** (#4) - Cost data is rich and historical. Regression is straightforward. Budget guardrails address the #1 user anxiety.
6. **Sentinel Mission Control** (#6) - Audit log data exists. Brings the self-healing story into the UI where users can actually see it working.

### Explore (Strategic bets)

7. **Cross-Session Intelligence** (#2) - Highest potential value but requires careful design of what insights actually matter. Start with 3-4 hardcoded analyses, expand based on what users find useful.
8. **Semantic Session Search** (#5) - Depends on indexing infrastructure. SQLite FTS5 could be a quick v1; embeddings are the v2.
9. **Context Window Visualizer** (#10) - Educational and unique. Needs careful token accounting from session data. Could start as a simple bar in session replay.
10. **Session Forking** (#3) - Most technically adventurous. Requires deep understanding of Claude's resume format. Highest wow-factor if it works.

---

## Compounding Effects

Several of these features compound when combined:

- **Intelligence Engine + Forecasting**: Insights inform budget recommendations ("your debugging sessions cost 3x more, budget accordingly")
- **Live Flight Deck + Budgets**: Real-time cost guardrails during active sessions
- **Session Search + Diff View**: Find a past session by what it changed, not just what was discussed
- **Sentinel Mission Control + Intelligence**: "Sentinel has fixed 12 type errors in `auth.ts` this month. Consider a refactor."
- **Heatmap + Weekly Digest**: The heatmap is the visual hook; the digest is the narrative

The strategic play is to build the quick wins first (diff view, digest, heatmap) to drive daily engagement, then layer on the intelligence and live features that make the product irreplaceable.
