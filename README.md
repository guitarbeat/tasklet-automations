# Tasklet Tooling

[![CI](https://github.com/guitarbeat/tasklet-automations/actions/workflows/ci.yml/badge.svg)](https://github.com/guitarbeat/tasklet-automations/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Monorepo for Tasklet instant apps, MCP developer tools, and GitHub/Jules automation.

This repository is the consolidation target for the former
[`guitarbeat/mcp-dev-console`](https://github.com/guitarbeat/mcp-dev-console) and
[`guitarbeat/tasklet-apps`](https://github.com/guitarbeat/tasklet-apps) projects. The
source repositories remain intact. The safe history strategy and exact source
revisions are recorded in [the consolidation record](docs/CONSOLIDATION.md)
along with the rationale, overlap analysis, and migration map.

## Workspaces

| Workspace                                       | Role                                          | Data model                            |
| ----------------------------------------------- | --------------------------------------------- | ------------------------------------- |
| [`apps/mcp-dev-console`](apps/mcp-dev-console/) | Explore, call, and audit MCP server tools     | Live MCP server connection            |
| [`apps/pr-health`](apps/pr-health/)             | Operate the Jules stale-PR pipeline           | Live GitHub and Tasklet state         |
| [`apps/pr-dashboard`](apps/pr-dashboard/)       | Review the historical PR automation portfolio | Baked snapshot generated May 24, 2026 |
| [`packages/mcp-client`](packages/mcp-client/)   | Shared MCP HTTP/SSE client                    | Runtime library                       |

`pr-health` and `pr-dashboard` intentionally remain separate. The first is an
interactive mission-control surface; the second preserves a generated reporting
snapshot. Treating them as one app would mix live operational state with historical
analytics and obscure data freshness.

## Automation

- `.agents/tasklet/` contains Tasklet agent instructions.
- `.github/workflows/stale-pr-rebase.yml` runs the Jules stale-PR pipeline.
- `.github/scripts/rebase_stale_prs.py` detects and queues stale pull requests.
- `.github/workflows/ci.yml` checks formatting and TypeScript across every workspace.

## Development

Requires Node.js 20 or later and pnpm 9.

```bash
pnpm install --frozen-lockfile
pnpm check
```

Individual Tasklet apps remain self-contained under `apps/` and can be copied into a
Tasklet apps folder when needed.

## Documentation

- [Architecture and design decisions](DESIGN.md)
- [Consolidation record](docs/CONSOLIDATION.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE)
