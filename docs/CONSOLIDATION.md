# Repository Consolidation Record

## Decision

`guitarbeat/tasklet-automations` is the consolidation target for:

- `guitarbeat/mcp-dev-console`
- `guitarbeat/tasklet-apps`
- `guitarbeat/tasklet-automations`

It was selected because it had the most active default branch, the broadest
repository maintenance setup, an existing pnpm workspace, and established Tasklet
automation documentation. Creating a fourth repository would duplicate that setup
and split the most recent project history.

The source repositories are not deleted, archived, renamed, or modified by this
consolidation.

## Final Structure

| Source                | Previous path         | Consolidated path      | Status                  |
| --------------------- | --------------------- | ---------------------- | ----------------------- |
| `mcp-dev-console`     | `apps/web`            | `apps/mcp-dev-console` | Active app              |
| `mcp-dev-console`     | `packages/mcp-client` | `packages/mcp-client`  | Active package          |
| `tasklet-apps`        | `apps/pr-dashboard`   | `apps/pr-dashboard`    | Historical snapshot app |
| `tasklet-automations` | `apps/pr-health`      | `apps/pr-health`       | Active operations app   |
| `tasklet-automations` | `.agents`, `.github`  | unchanged              | Active automation       |

## Overlap and Conflict Resolution

### Shared monorepo conventions

Both `mcp-dev-console` and `tasklet-automations` used `apps/*`, `packages/*`, MIT,
TypeScript, React 19, pnpm-compatible workspaces, and similar formatting rules. The
target's root configuration remains authoritative so there is one CI and dependency
graph.

### Two PR dashboards

The dashboards overlap in subject matter but not responsibility:

- `pr-health` reads live GitHub and Tasklet state and can trigger agent actions.
- `pr-dashboard` renders baked data generated on May 24, 2026 for historical
  reporting and does not call the live GitHub bridge.

Both are retained to avoid losing functionality. Documentation and Tasklet metadata
now identify the baked dashboard as a historical portfolio instead of a live view.

### MCP package naming

The imported `@mcp-dev-console/*` workspace names are now
`@tasklet-automations/*`. The console still uses the same client implementation and
Tasklet runtime APIs.

### TypeScript configuration

The MCP app previously contained an absolute `/tmp/tasklet-deps/...` path tied to a
single generated environment. It now extends the shared root configuration and uses
workspace-installed types, making local and CI checks reproducible.

### Repository-level files

The target's workflows, issue templates, security policy, contribution guide, and
automation instructions remain authoritative. Source-repository copies were not
duplicated. Labels and documentation were expanded for the imported workspaces.

## History Preservation

The consolidation branch contains a merge commit whose secondary parent is the
`tasklet-apps` default-branch tip (`661878d`). Its application tree was checked out
from that exact revision, preserving the complete four-commit source graph.

The MCP application and package trees were imported from `mcp-dev-console` revision
`e1ffeb6`, but that source graph was deliberately not linked as a merge parent. The
source history contains an embedded bearer token, and linking it would make the
credential-bearing objects reachable from this repository. The original repository
remains the authoritative historical record; exact revision provenance is retained
here without propagating unsafe history.

The token was removed from the consolidated application. It should still be rotated
at its provider because removing it from this tree cannot invalidate a credential
that was previously public.

Open, unmerged source pull requests were not imported because they are not part of
the source repositories' default branches. They remain available in their original
repositories for separate review.

## Future Repository State

After this branch is reviewed and merged, the originals can remain as read-only
references. Archiving them is optional and intentionally outside the scope of this
change.
