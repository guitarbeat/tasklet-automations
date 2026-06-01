# AI Rules

## Tech Stack

- **React 19** + **TypeScript** — Dashboard UI
- **Lucide React** — Icons
- **Tasklet instant app runtime** — Bundling and hosting
- **Python 3** — GitHub Actions scripts
- **pnpm** — Package manager (workspace enabled)
- **Prettier** — Code formatting

## Coding Rules

1. **Single-file dashboard**: All dashboard code lives in `apps/pr-health/app.tsx`. Do not split into separate component files.
2. **Tasklet API**: Use `window.tasklet` for `sendMessageToAgent`, `sqlQuery`, `sqlExec`. Do not import from a bridge module.
3. **Lucide React**: Use for all icons. Do not use other icon libraries.
4. **No external CSS frameworks**: Use inline styles and the custom `styles.css` for animations. No Tailwind.
5. **Database column**: The queue table column is `state`, not `status`. Always double-check SQL queries.
6. **Sequential pipeline**: Only one Jules conversation at a time. Never batch-ping multiple PRs.
7. **Conventional commits**: Use `feat:`, `fix:`, `docs:`, `chore:` prefixes with optional scopes.
8. **Prettier config**: Follow `.prettierrc` — single quotes, trailing commas, 100 char width.
9. **Keep it simple**: Prioritize readable, maintainable code over clever abstractions.
