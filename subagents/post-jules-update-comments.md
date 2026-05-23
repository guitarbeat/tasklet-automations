# Post @jules Update Comments on Stale PRs

Posts a comment on each stale PR asking @jules to update the branch to latest main.

## Instructions

You have access to the GitHub tool `conn_8et0d5bx3yszdanafpnb__github_create_issue_comment`.

Post a comment on every PR number in the payload. The comment should be:

```
@jules Please rebase this branch onto the latest `main` and update this PR to resolve any conflicts.
```

Post the comment to the owner/repo and issue_number specified in the payload.

Work through ALL PRs in the list. For each one, call `conn_8et0d5bx3yszdanafpnb__github_create_issue_comment` with:
- owner: from payload
- repo: from payload  
- issue_number: the PR number
- body: the comment text above

Process them sequentially. Report back how many comments were successfully posted and any failures.
