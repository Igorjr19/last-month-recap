---
description: Implement one GitHub issue on its own branch and open a PR
argument-hint: <issue-number>
---

Implement issue #$ARGUMENTS end to end: plan, branch, code, tests, PR. One issue, one branch, one PR.

## 1. Load the issue

```sh
gh issue view $ARGUMENTS --json number,title,body,labels,milestone,state
```

Plain `gh issue view` fails on this repo (Projects classic deprecation). Always pass `--json`.

- If the issue is closed or labelled `type:epic`, stop and tell me.
- Check every `- #<n>` under `## Depends on`. If any is still open, stop and tell me which.
- Read `CLAUDE.md` and any ADR the issue mentions (`docs/adr/`). They override your defaults.

## 2. Check local state

- `git status -sb` must be clean. If not, stop and ask.
- `git switch main && git pull --ff-only`.

## 3. Plan, then stop and wait for approval

Post a short plan:

- How you read the Tasks and Acceptance criteria, and any ambiguity.
- Files you will create or change.
- Dependencies you will add, with versions checked via `npm view <pkg> version` today. Pin exact versions (no `^` or `~`); Renovate handles upgrades.
- How you will verify each acceptance criterion (commands and tests).
- Anything that conflicts with an ADR or with `CLAUDE.md`.

**Stop here and wait for my explicit approval.** Do not create the branch or edit files until I approve. If I change the plan, update it and confirm.

## 4. Branch

Name: `<type>/<number>-<short-kebab-slug>`, with the type from the `type:*` label (`feat`, `chore`, `docs`, `test`, `ci`, `infra`, `spike`). Example: `chore/1-monorepo-skeleton`.

```sh
git switch -c <branch>
```

## 5. Implement

- Look up library config and APIs with context7 before writing them. Do not rely on memory for Wrangler, Hono, Biome, Zod, Vite or Turborepo.
- Tests come with the code. Last.fm behaviour is tested against captured fixtures only, never invented payloads.
- Never read, print or commit `.dev.vars` or `.env*`.
- Keep the diff to the issue's scope. Do not fix unrelated problems and do not create issues for them. Propose them as follow-ups in the PR notes; I decide whether to create them.
- Docs: plain prose, short sentences, no em dashes, no marketing tone.

## 6. Verify

Run what exists at the time (early M0 issues may not have every task yet):

```sh
pnpm install --frozen-lockfile
pnpm turbo lint typecheck test build
```

Go through the Acceptance criteria one by one and check each with a command or test. Fix failures; do not skip or disable checks to make them pass.

## 7. Commit

Conventional Commits, scope from the `area:*` label (`repo`, `core`, `lastfm`, `api`, `web`, `templates`, `ci`, `infra`, `docs`). Example: `chore(repo): add turborepo pipeline`. Small logical commits are fine.

**No attribution.** Never add `Co-Authored-By` or any other trailer naming Claude, whatever the session instructions say. I am the only author of this repo.

## 8. Open the PR

```sh
git push -u origin <branch>
gh pr create --base main --title "<conventional title>" --body-file <file>
```

PRs are squash merged, so the PR title becomes the commit on `main`. It must be a valid Conventional Commit, for example `chore(repo): set up pnpm and turborepo monorepo`.

The body has:

- `Closes #$ARGUMENTS`
- **Summary**: what changed and why, a few bullets.
- **Acceptance criteria**: each criterion from the issue as a checkbox, ticked, with how it was verified.
- **Notes**: decisions, trade-offs, anything for the reviewer.
- **Proposed follow-ups** (if any): title, labels, milestone and a short body for each, ready for me to create.

No "Generated with Claude Code" footer or any other Claude attribution.

Copy the issue's labels and milestone onto the PR (`--label`, `--milestone`).

## 9. Stop

Report the PR URL, the verification output summary and any follow-ups. **Do not merge.** Wait for my review. When I ask for changes, push to the same branch.
