# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Monorepo structure with pnpm workspaces (`apps/*`, `packages/*`)
- PR Health Dashboard (`apps/pr-health`) — session-focused mission control
- Jules rebase pipeline — sequential stale PR detection and resolution
- GitHub Actions workflow for automated stale PR detection
- Tasklet subagent instructions for pipeline automation
- CI workflow (lint + type-check)
- Dependabot config for npm, pip, and GitHub Actions
- Auto-labeler for PRs by changed file paths
- Issue and PR templates
- CODEOWNERS, CONTRIBUTING, SECURITY, and AI rules documentation
- Bidirectional sync between Tasklet filesystem and GitHub repo

### Pipeline Evolutions
1. ✅ Smarter staleness detection (anchored SHA comparison)
2. ✅ Jules follow-up loop (re-ping persistent stale PRs)
3. ✅ Auto-close dead PRs >90 days with advisory comments
4. ⏳ GitHub Actions CI (blocked on Tasklet app write permissions)
5. ✅ PR Health Dashboard (live view, agent-integrated, session-focused)
