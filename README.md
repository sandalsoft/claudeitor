# Claudeitor

[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.50+-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev/docs/kit)
[![Svelte 5](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![D3.js](https://img.shields.io/badge/D3.js-7.9+-F9A03C?logo=d3dotjs&logoColor=white)](https://d3js.org)
[![License](https://img.shields.io/badge/License-Private-gray)]()

A localhost dashboard that turns your `~/.claude/` directory into rich, interactive visualizations. Track sessions, costs, model usage, repository health, and configuration — all from a single page you never have to leave your terminal for.

## Quick Start

```bash
git clone https://github.com/sandalsoft/claudeitor.git
cd claudeitor
pnpm install
cp claudeitor.config.example.json claudeitor.config.json
pnpm dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). That's it — Claudeitor reads directly from your local Claude data files, no database or external services required.

## What You Get

**Readout** — The main dashboard. Four stat cards with 7-day trend indicators, three interactive D3.js charts (30-day activity, hourly work distribution, cost by model), recent sessions, alerts for uncommitted work, and active repos. Updates in real-time via SSE.

**Sessions** — Browse your full Claude Code session history. Click into any session for token counts, costs, duration, and files touched. Replay conversations on a scrubable timeline. AI-powered summaries when you provide an API key.

**Costs** — Daily cost trends, input/output/cache token breakdowns, per-model analysis. Set a threshold and get alerted when spending crosses it.

**Live** — See active Claude sessions, current models in use, and a real-time activity feed.

**Repos** — Track all your git repositories. Commit counts, branch info, uncommitted and unpushed change detection.

**Config** — Read-only views of your Skills, Agents, CLAUDE.md memory files, and Hooks.

**Settings** — Theme switching (system/light/dark), API key management, model selection, repo directory configuration, and a `Cmd+K` command palette to jump anywhere instantly.

## Getting Started

### Prerequisites

- **Node.js 18+**
- **pnpm** (recommended) or npm
- An existing `~/.claude/` directory (created automatically by [Claude Code](https://claude.com/claude-code))

### Install

```bash
git clone https://github.com/sandalsoft/claudeitor.git
cd claudeitor
pnpm install
```

### Configure

```bash
cp claudeitor.config.example.json claudeitor.config.json
```

Edit `claudeitor.config.json`:

```jsonc
{
  "claudeDir": "~/.claude",             // Path to your Claude data directory
  "repoDirs": [                          // Git repos to monitor
    "~/projects/my-app",
    "~/projects/another-repo"
  ],
  "anthropicApiKey": "",                 // Optional: enables AI session summaries
  "aiModel": "claude-sonnet-4-5-20250929",
  "costAlertThreshold": 50,             // USD threshold for cost alerts
  "refreshInterval": 30000,             // Live page polling interval (ms)
  "themeOverride": "system"             // "system", "light", or "dark"
}
```

> **Note:** `claudeitor.config.json` is gitignored. Only the `.example` file is committed. Your API key never leaves the server — the client only receives a `hasApiKey` boolean.

### Run

```bash
# Development (hot-reload)
pnpm dev

# Production
pnpm build
pnpm start         # Runs on 127.0.0.1:3000
```

### Verify

```bash
pnpm check         # TypeScript type checking
pnpm test          # 97 unit tests across data layer
```

## Data Sources

Claudeitor reads directly from your local filesystem. No database, no cloud sync, no data ever leaves your machine.

| File | What it provides |
|------|-----------------|
| `~/.claude/stats-cache.json` | Daily activity, model usage, hourly distribution, session counts |
| `~/.claude/readout-cost-cache.json` | Per-day, per-model token usage (input/output/cache) |
| `~/.claude/readout-pricing.json` | Model pricing for cost calculations |
| `~/.claude/history.jsonl` | Full session history with timestamps and project context |
| `~/.claude/settings.json` | Claude Code settings, hooks, enabled plugins |
| `~/.claude/skills/` | Custom skills with SKILL.md metadata |
| `~/.claude/agents/` | Custom agents with model/tool configuration |
| `~/.claude/projects/` | Per-project CLAUDE.md memory files |

## Architecture

```
src/
├── routes/                  # SvelteKit pages
│   ├── +page.svelte         # Readout (home dashboard)
│   ├── sessions/            # Session list + detail + replay
│   ├── costs/               # Cost analysis
│   ├── live/                # Active session monitoring
│   ├── repos/               # Repository health
│   ├── skills/              # Skills browser
│   ├── agents/              # Agents browser
│   ├── memory/              # CLAUDE.md viewer
│   ├── hooks/               # Hooks viewer
│   ├── settings/            # App settings
│   └── api/sse/             # SSE endpoint
├── lib/
│   ├── server/claude/       # Data readers (server-only)
│   ├── server/git/          # Git scanner
│   ├── components/
│   │   ├── charts/          # D3.js chart components
│   │   ├── cards/           # StatCard, SessionCard, AlertCard
│   │   ├── layout/          # Sidebar, Header, CommandPalette
│   │   └── sessions/        # SessionDetail, SessionReplay
│   ├── data/types.ts        # Shared TypeScript interfaces
│   └── stores/              # Svelte 5 rune-based stores
```

**Key design decisions:**

- **Server-only data access** — All `~/.claude/` readers live in `src/lib/server/`, enforced by SvelteKit's module boundary. No file paths or raw data leak to the browser.
- **Cache-first loading** — Reads pre-computed caches before falling back to parsing raw JSONL.
- **Split git caching** — Expensive commit logs are cached by HEAD hash. Working-tree status (`git status --porcelain`) is always fresh.
- **SSE scoped to Readout** — Only the main dashboard uses Server-Sent Events via a Chokidar file watcher singleton. The Live page uses polling to keep the SSE surface area minimal.
- **Multi-strategy model ID mapping** — Handles the discrepancy between full model IDs in stats (`claude-opus-4-5-20251101`) and short names in pricing (`opus-4-5`) via exact match, regex extraction, normalization, and graceful fallback.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server at `127.0.0.1:5173` with HMR |
| `pnpm build` | Production build via SvelteKit + Node adapter |
| `pnpm preview` | Preview production build locally |
| `pnpm start` | Run production server at `127.0.0.1:3000` |
| `pnpm check` | TypeScript type checking |
| `pnpm check:watch` | Type checking in watch mode |
| `pnpm test` | Run Vitest unit tests |
| `pnpm test:watch` | Tests in watch mode |

## Security

Claudeitor is designed for single-user, localhost-only use:

- **Server binds to `127.0.0.1`** — Never `0.0.0.0`. Not accessible from the network in dev, preview, or production.
- **API key stays server-side** — The Anthropic API key is read from config on the server and never serialized to the client. The browser only knows whether a key is configured (`hasApiKey: true/false`).
- **Config is gitignored** — `claudeitor.config.json` is in `.gitignore`. Only the `.example` template is committed.
- **No authentication** — Unnecessary since the server is only reachable from your own machine.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit 2.50+ with Svelte 5 (runes) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| Charts | D3.js 7.9+ (SVG, interactive) |
| UI Components | Bits UI (Command palette) |
| Real-time | sveltekit-sse + Chokidar |
| AI Summaries | Anthropic SDK (optional) |
| Server | Node adapter (persistent process) |
| Testing | Vitest |
| Language | TypeScript (strict mode) |

## Contributing

This is a personal project. Issues and ideas are welcome at [github.com/sandalsoft/claudeitor](https://github.com/sandalsoft/claudeitor).

```bash
# Development workflow
pnpm install
cp claudeitor.config.example.json claudeitor.config.json
pnpm dev           # Start developing
pnpm test          # Run tests before committing
pnpm check         # Verify types
```

---

Built with Svelte 5, powered by Claude Code data.
