# Sync Tasklet Automations Repo

Bidirectional sync between local Tasklet files and the `guitarbeat/tasklet-automations` GitHub repo.

## Instructions

You sync files between the local Tasklet filesystem and the GitHub repo `guitarbeat/tasklet-automations`.

### File Mapping

| Local Path | Repo Path |
|---|---|
| `/agent/home/apps/pr-health/app.tsx` | `apps/pr-health/app.tsx` |
| `/agent/home/apps/pr-health/styles.css` | `apps/pr-health/styles.css` |
| `/agent/home/apps/pr-health/types.ts` | `apps/pr-health/types.ts` |
| `/agent/home/apps/pr-health/utils/helpers.ts` | `apps/pr-health/utils/helpers.ts` |
| `/agent/home/apps/pr-health/tasklet-env.d.ts` | `apps/pr-health/tasklet-env.d.ts` |
| `/agent/home/apps/pr-health/tasklet.config.json` | `apps/pr-health/tasklet.config.json` |
| `/agent/home/apps/pr-health/package.json` | `apps/pr-health/package.json` |
| `/agent/home/apps/pr-health/tsconfig.json` | `apps/pr-health/tsconfig.json` |
| `/agent/home/stale-pr-rebase/stale-pr-rebase.yml` | `workflows/stale-pr-rebase.yml` |
| `/agent/home/stale-pr-rebase/rebase_stale_prs.py` | `workflows/rebase_stale_prs.py` |
| `/agent/subagents/jules-rebase-stale-prs.md` | `subagents/jules-rebase-stale-prs.md` |
| `/agent/subagents/build-pr-dashboard.md` | `subagents/build-pr-dashboard.md` |
| `/agent/subagents/delete-jules-sessions.md` | `subagents/delete-jules-sessions.md` |
| `/agent/subagents/post-jules-update-comments.md` | `subagents/post-jules-update-comments.md` |
| `/agent/subagents/sync-repo.md` | `subagents/sync-repo.md` |

### Sync Direction (from payload)

The payload will contain a JSON object with a `direction` field: `"push"`, `"pull"`, or `"both"`.

### Push (local → GitHub)

1. For each file in the mapping, read the local file content using `read_file`.
2. Compute an md5 hash of the local content using `run_command`.
3. Also download the repo version using `github_get_file_content` (owner: `guitarbeat`, repo: `tasklet-automations`).
4. Compare. If they differ, collect the changed file for pushing.
5. If there are changes, use `github_push_to_branch` to push all changed files in a single commit to `main`:
   - owner: `guitarbeat`
   - repo: `tasklet-automations`
   - branch: `main`
   - commitMessage: `sync: update from Tasklet [auto]` followed by a list of changed files
   - files: array of `{repoPath, localPath}` objects where `localPath` is the local file path
6. Report what was pushed (or "no changes").

### Pull (GitHub → local)

1. For each file in the mapping, use `github_get_file_content` to get the repo version.
2. Read the local file using `read_file`.
3. Compare content. If they differ, write the repo version to the local path using `write_file`.
4. Report what was pulled (or "no changes").

### Both

Run push first, then pull. Push takes priority — if both sides changed the same file, the local version wins.

### Error Handling

- If a local file doesn't exist, skip it during push (don't error).
- If a repo file doesn't exist (404), skip it during pull.
- Report all errors clearly in the final message.

### Output

Return a concise summary:
```
Sync complete (direction: push/pull/both)
Pushed: file1.tsx, file2.md (or "nothing")
Pulled: file3.py (or "nothing")
Errors: none (or list them)
```
