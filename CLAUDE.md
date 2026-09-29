# CLAUDE.md

Guidance for Claude Code sessions in this repository. Read it before any task.

## Purpose

A web app that turns one calendar month of a Last.fm user's scrobbles into a
shareable image card (1080x1920 story format first). The user enters a Last.fm
username, a month and a timezone, picks a card layout, customizes it and
downloads or shares a PNG. It is a portfolio piece for DevOps and Platform
Engineering roles, so code, commits, issues, ADRs and docs are in English. It
must run in production at zero monthly cost. The visual identity is original:
no Spotify name, logo or copied layout anywhere.

## Layout

```
apps/
  api/          @recap/api            Hono HTTP API. Workers now, Node later.
  web/          @recap/web            React + Vite SPA. Renders and exports cards.
packages/
  core/         @recap/core           RecapData contract (Zod) and pure aggregation. No I/O.
  lastfm/       @recap/source-lastfm  Typed Last.fm client with an injected fetch.
  templates/    @recap/templates      Card template definitions and registry.
docs/adr/       Architecture decision records (MADR). Index: docs/adr/README.md
scripts/backlog/  One-off script that created the GitHub labels, milestones and issues.
.claude/commands/ /next and /issue workflows.
```

Each package builds `src/` to `dist/` with `tsc` and exports from `dist/`.
Declare cross-package dependencies as `workspace:*`.

## Commands

Toolchain versions are pinned in `mise.toml` and `packageManager` (Node 26,
pnpm 12). Run everything from the repo root.

```sh
pnpm install --frozen-lockfile      # install; also installs lefthook git hooks
pnpm turbo lint typecheck test build  # full check, same as the pre-push hook
pnpm turbo test                     # run all tests
pnpm turbo test --filter @recap/core  # tests for one package
pnpm turbo typecheck                # tsc --noEmit in every package
pnpm turbo build                    # build every package to dist/
pnpm lint                           # biome check on the whole repo
pnpm fix                            # biome check --write (format, imports, safe fixes)
```

How tests run: each package gets a `test` script (Vitest) and Turborepo runs
them after building dependencies. Vitest and Vite are dev dependencies of each
package that has tests. Tests live in `<package>/test/`, outside `src/`, so
they are not built to `dist/`. A `test/tsconfig.json` lets the `typecheck`
script cover them. Packages without tests have no `test` script yet.

Planned commands, not available yet:

- `pnpm fixtures:capture --user <name> --month YYYY-MM`: saves real Last.fm
  responses under `packages/lastfm/test/fixtures/` (#8).
- `pnpm --filter @recap/api exec wrangler dev`: local Worker on
  `http://localhost:8787` (#12, #25).

Update this section when a planned command lands.

## Git hooks

Installed by lefthook on `pnpm install` (`lefthook.yml`):

- pre-commit: Biome on staged files, then typecheck.
- commit-msg: commitlint.
- pre-push: `turbo run lint typecheck test build`.

Do not bypass them with `--no-verify`. Fix the failure instead.

CI runs the same full check on every PR and push to `main`. See
[docs/ci.md](docs/ci.md). The required check is the `ci` job.

## Architecture invariants

Decided. Do not reopen them. If you find a strong reason against one, stop and
ask. Details are in the ADRs, indexed in `docs/adr/README.md`.

1. Monorepo with pnpm workspaces and Turborepo. The API keeps runtime-specific
   code in thin adapters (`src/runtime/workers.ts`, later `src/runtime/node.ts`).
   See [ADR-0001](docs/adr/0001-monorepo-and-portable-hono-api.md).
2. Track A renders the PNG in the browser. Workers Free allows 10 ms of CPU per
   request, too little for server rendering. The API returns aggregated JSON
   and proxies images so the canvas is not tainted. See [ADR-0002](docs/adr/0002-client-side-png-rendering.md).
3. Templates are portable. They use only the JSX and CSS subset Satori
   supports: flexbox, inline styles, TTF fonts, absolute image URLs. A test
   renders every template through Satori. See [ADR-0002](docs/adr/0002-client-side-png-rendering.md).
4. Templates are pluggable. A `TemplateDefinition` declares id, version,
   formats, required data features, an options Zod schema, defaults and a
   component. A registry exposes `listTemplates()`, `getTemplate(id, version?)`
   and `requiredFeatures(id)`. New layouts ship without touching `apps/api`.
   See [ADR-0003](docs/adr/0003-pluggable-card-templates.md).
5. Customization state lives in the URL (`?t=classic@1&f=story&o=<base64url>`)
   and is validated against the template's options schema. Old template
   versions stay registered so shared links keep working. See [ADR-0003](docs/adr/0003-pluggable-card-templates.md).
6. Cache by month immutability. A closed month is cached with no TTL, the
   current month for 1 hour. A month counts as closed a few days after it
   ends, to allow late scrobbles. Cache keys include the schema version.
   See [ADR-0004](docs/adr/0004-cache-by-month-immutability.md).
7. Free-tier limits are design inputs: 100k requests per day per account,
   10 ms CPU, 50 subrequests per request, 1,000 KV writes per day.
8. The Last.fm API key lives only on the server.
9. Two deploy tracks. Track A: Cloudflare Workers, static assets and KV.
   Track B: OCI Always Free ARM VM with k3s, Terraform, Helm, Argo CD, GHCR and
   Trivy. The same code serves both.
10. `RecapData` is the only thing the API and templates share. Templates never
    see Last.fm payloads. The API returns only the optional features requested
    via `?include=`.

## Conventions

- GitHub issues are the source of truth. Use `/next` to pick one and
  `/issue <n>` to implement it. `gh issue view` needs `--json` on this repo.
- One issue, one branch, one PR. Branch: `<type>/<number>-<slug>`, for example
  `chore/1-monorepo-skeleton`.
- Conventional Commits with a required scope from the `area:*` labels: `repo`,
  `core`, `lastfm`, `api`, `web`, `templates`, `ci`, `infra`, `docs`.
  PRs are squash merged, so the PR title must be a valid commit message.
- No Claude attribution in commits or PRs: no `Co-Authored-By` trailer, no
  "Generated with Claude Code" footer.
- Pin dependency versions exactly (`saveExact: true`). Check the current
  version with `npm view <pkg> version`. Renovate handles upgrades.
- Check library APIs and config formats with context7 before writing them.
  Do not rely on memory for Wrangler, Hono, Biome, Zod, Vite or Turborepo.
- TypeScript is strict, with `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. ESM only.
- Formatting and linting: Biome, 2 spaces, LF. A Claude Code hook formats every
  file you edit.
- Tests come with the code, in the same PR.
- Last.fm behaviour is tested against captured fixtures in
  `packages/lastfm/test/fixtures/`.
- Keep the diff to the issue's scope. Propose unrelated fixes as follow-ups
  in the PR notes. Do not create issues for them.
- Docs: plain prose, short sentences, no em dashes, no marketing tone.

## Secrets

`LASTFM_API_KEY` goes in `apps/api/.dev.vars` (git-ignored). Copy
`apps/api/.dev.vars.example` to create it. In deployed environments it is a
`wrangler secret`. `.claude/settings.json` denies reading `.dev.vars` and
`.env*` files.

## Never do

- Read, print or commit `.dev.vars`, `.env*` or any secret.
- Invent Last.fm payloads. Capture real ones with the fixtures script.
- Put template knowledge in `apps/api`.
- Use CSS or JSX in templates that Satori cannot render (grid, classes,
  external stylesheets, relative image URLs, non-TTF fonts).
- Skip, disable or weaken tests, lint rules or hooks to make a check pass.
- Add I/O to `packages/core`.
- Merge a PR. The owner reviews and merges.
- Use the Spotify name, logo or layouts.
