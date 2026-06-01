# tasklet-automations

A monorepo for Tasklet AI automation tooling that keeps GitHub repos clean and PRs healthy.

## Core Concept

This project automates the detection and resolution of stale pull requests using a sequential pipeline powered by [Jules](https://jules.google) (Google's AI coding agent) and [Tasklet AI](https://tasklet.ai).

## Language

**Stale PR**:
A pull request whose base branch has moved ahead, leaving the PR behind and potentially causing merge conflicts.
_Avoid_: outdated PR, old PR, behind PR

**Jules Pipeline**:
The automated sequential workflow that scans repos, queues stale PRs, pings Jules to rebase them one at a time, and monitors resolution.
_Avoid_: rebase bot, auto-merger

**Queue**:
The ordered list of stale PRs waiting for Jules attention, stored in the `jules_queue` database table. Only one PR is active at a time.
_Avoid_: backlog, task list, work items

**Dashboard**:
The PR Health Dashboard — a live, agent-integrated mission control UI for monitoring the pipeline.
_Avoid_: admin panel, control panel, status page

**Ping**:
Posting an `@jules` comment on a GitHub PR to trigger a rebase session.
_Avoid_: mention, tag, notify, request
