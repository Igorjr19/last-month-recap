# Continuous integration

The workflow lives in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
It runs on every pull request and on every push to `main`.

## What it runs

One job, `ci`, on `ubuntu-latest`:

1. Check out the code without persisting the token.
2. Install Node and pnpm with `jdx/mise-action`, using the versions in
   `mise.toml`. Local and CI toolchains come from the same file.
3. Restore the pnpm store and the Turborepo cache.
4. `pnpm install --frozen-lockfile`.
5. `pnpm turbo run lint typecheck test build --summarize`. This is the same
   set of tasks as the pre-push hook.
6. Write a table of turbo tasks, their status, cache result and duration to
   the job summary. `scripts/ci/turbo-summary.sh` builds it from the turbo run
   summary. It runs even when the checks fail.

## Caches

- pnpm store: keyed on `pnpm-lock.yaml`. A lockfile change falls back to the
  most recent store for the same OS.
- Turborepo: `.turbo/cache`, keyed on the commit SHA with a fallback to the
  most recent entry. Tasks whose inputs did not change are restored instead of
  run.

GitHub scopes caches by branch. A PR can read caches from `main`, so runs on
new PRs start warm once `main` has a run.

## Security

- The workflow token only has `contents: read`.
- Third-party actions are pinned by full commit SHA, with the version in a
  comment. Renovate updates them (#6).
- `actions/checkout` does not persist credentials.
- No step uses event data such as PR titles or branch names in shell commands.

## Concurrency

A new push to a PR cancels the run still in progress for that PR. Pushes to
`main` each get their own group and are never cancelled.

## Protecting main

Branch protection is not stored in the repository. Run this once as a repo
admin. It requires a PR and a green `ci` check on an up-to-date branch before
merging, and blocks force pushes and deletion of `main`. It requires no
approving reviews, so the owner can merge their own PRs. `enforce_admins` is
off so an admin can still fix `main` in an emergency.

```sh
gh api --method PUT repos/Igorjr19/last-month-recap/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "checks": [{ "context": "ci" }]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

Check the result:

```sh
gh api repos/Igorjr19/last-month-recap/branches/main/protection \
  --jq '{checks: .required_status_checks.checks, strict: .required_status_checks.strict}'
```

If the `ci` job is renamed, update the check name here and in the protection
rule, or every PR will wait for a check that never runs.
