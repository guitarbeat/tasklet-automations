"""
rebase_stale_prs.py

Finds open PRs that are behind the default branch and creates Jules sessions
to automatically rebase them. Falls back to posting an @jules comment if no
Jules source is connected for this repo.

Required env vars:
  GITHUB_TOKEN  - GitHub Actions token (provided automatically)
  JULES_API_KEY - Jules API key (add as a repo/org secret)
  REPO_OWNER    - Repo owner (provided by workflow)
  REPO_NAME     - Repo name (provided by workflow)

Optional env vars:
  BASE_BRANCH   - Branch to compare against (default: main)
  DRY_RUN       - Set to "true" to print without creating sessions
"""

import os
import sys
import time
import requests

# ── Config ────────────────────────────────────────────────────────────────────

GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
JULES_API_KEY = os.environ["JULES_API_KEY"]
REPO_OWNER   = os.environ["REPO_OWNER"]
REPO_NAME    = os.environ["REPO_NAME"]
BASE_BRANCH  = os.environ.get("BASE_BRANCH", "main")
DRY_RUN      = os.environ.get("DRY_RUN", "false").lower() == "true"

GITHUB_API = "https://api.github.com"
JULES_API  = "https://jules.googleapis.com/v1alpha"

GITHUB_HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

JULES_HEADERS = {
    "X-Goog-Api-Key": JULES_API_KEY,
    "Content-Type": "application/json",
}

# ── GitHub helpers ─────────────────────────────────────────────────────────────

def get_base_sha(owner: str, repo: str, branch: str) -> str:
    """Get the current HEAD SHA of the base branch."""
    url = f"{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{branch}"
    r = requests.get(url, headers=GITHUB_HEADERS)
    r.raise_for_status()
    return r.json()["object"]["sha"]


def get_open_prs(owner: str, repo: str) -> list[dict]:
    """Return all open PRs for a repo (handles pagination)."""
    prs, page = [], 1
    while True:
        r = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/pulls",
            params={"state": "open", "per_page": 100, "page": page},
            headers=GITHUB_HEADERS,
        )
        r.raise_for_status()
        batch = r.json()
        prs.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return prs


def post_fallback_comment(owner: str, repo: str, pr_number: int) -> None:
    """Post an @jules comment as a fallback when no Jules source is connected."""
    r = requests.post(
        f"{GITHUB_API}/repos/{owner}/{repo}/issues/{pr_number}/comments",
        headers=GITHUB_HEADERS,
        json={"body": "@jules Please rebase this branch onto the latest `main` and update this PR to resolve any conflicts."},
    )
    r.raise_for_status()


# ── Jules helpers ──────────────────────────────────────────────────────────────

def get_jules_sources() -> list[dict]:
    """Return all GitHub repos connected to Jules."""
    r = requests.get(f"{JULES_API}/sources", headers=JULES_HEADERS)
    r.raise_for_status()
    return r.json().get("sources", [])


def find_jules_source(sources: list[dict], owner: str, repo: str) -> dict | None:
    """Find the Jules source matching owner/repo (case-insensitive)."""
    target = f"{owner}/{repo}".lower()
    for s in sources:
        if target in s.get("name", "").lower():
            return s
    return None


def create_jules_session(source_id: str, branch: str, pr_number: int, pr_title: str) -> dict:
    """Create a Jules session to rebase a branch onto main."""
    payload = {
        "sourceId": source_id,
        "automationMode": "AUTO_CREATE_PR",
        "task": (
            f"Rebase branch `{branch}` onto the latest `{BASE_BRANCH}` to bring "
            f'PR #{pr_number} ("{pr_title}") up to date. '
            f"Resolve any merge conflicts that arise, preferring changes from `{branch}` "
            f"unless the conflict is clearly an outdated assumption."
        ),
    }
    r = requests.post(f"{JULES_API}/sessions", headers=JULES_HEADERS, json=payload)
    r.raise_for_status()
    return r.json()


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    full_repo = f"{REPO_OWNER}/{REPO_NAME}"
    print(f"{'[DRY RUN] ' if DRY_RUN else ''}Scanning {full_repo} for PRs behind `{BASE_BRANCH}`...\n")

    # Get current HEAD of base branch
    try:
        base_sha = get_base_sha(REPO_OWNER, REPO_NAME, BASE_BRANCH)
    except requests.HTTPError as e:
        print(f"✗ Could not fetch {BASE_BRANCH} SHA: {e}")
        sys.exit(1)
    print(f"Current {BASE_BRANCH} SHA: {base_sha[:8]}\n")

    # Fetch all open PRs
    prs = get_open_prs(REPO_OWNER, REPO_NAME)
    print(f"Open PRs found: {len(prs)}")

    # A PR is stale when its base.sha differs from the current base branch HEAD
    stale = [pr for pr in prs if pr["base"]["sha"] != base_sha]
    current = len(prs) - len(stale)
    print(f"  ✓ Up to date : {current}")
    print(f"  ⚠ Stale      : {len(stale)}\n")

    if not stale:
        print("Nothing to do — all PRs are current!")
        return

    # Look up Jules sources once
    try:
        sources = get_jules_sources()
        jules_source = find_jules_source(sources, REPO_OWNER, REPO_NAME)
    except Exception as e:
        print(f"Warning: Could not fetch Jules sources ({e}). Will use @jules comment fallback.")
        jules_source = None

    if jules_source:
        print(f"Jules source: {jules_source.get('name')} (id: {jules_source['id']})\n")
    else:
        print(f"No Jules source found for {full_repo} — will post @jules comments instead.\n")

    created = failed = 0

    for pr in stale:
        pr_num   = pr["number"]
        branch   = pr["head"]["ref"]
        title    = pr["title"]
        label    = f"PR #{pr_num}: {title[:55]}{'…' if len(title) > 55 else ''}"

        print(f"  {label}")
        print(f"    branch: {branch}")

        if DRY_RUN:
            print("    → [dry run] skipped\n")
            continue

        try:
            if jules_source:
                session = create_jules_session(jules_source["id"], branch, pr_num, title)
                session_name = session.get("name", "unknown")
                print(f"    → Jules session created: {session_name}")
            else:
                post_fallback_comment(REPO_OWNER, REPO_NAME, pr_num)
                print(f"    → @jules comment posted")
            created += 1
        except Exception as e:
            print(f"    ✗ Failed: {e}")
            failed += 1

        # Be a polite API citizen
        time.sleep(1)

        print()

    print("─" * 60)
    print(f"Done!  Created: {created}  |  Failed: {failed}")

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
