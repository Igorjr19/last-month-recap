# Session: bootstrap the repository (milestone M0 · Foundation)

You are working in my portfolio repository. This session sets up the foundation: monorepo, tooling, Claude Code workflow, ADRs and CI. You will not write product features today.

## The project

A web app that turns a Last.fm user's scrobbles for one calendar month into a shareable image card (1080x1920 story format first), in the spirit of the monthly listening recaps from streaming apps. The user types a Last.fm username, picks a month and a timezone, chooses a card layout, customizes it and downloads or shares a PNG.

Goals, in order:
1. Portfolio piece aimed at DevOps / Platform Engineering roles, including international ones. Code, commits, issues, ADRs and docs are in English.
2. Runs in production at zero monthly cost.
3. Small enough to ship Track A in a few weeks.

The visual identity is original. No Spotify name, logo or copied layout anywhere.

## Decisions already made

Encode these in the ADRs and in CLAUDE.md. Do not reopen them; if you find a strong reason against one, tell me before acting.

1. **Monorepo** with pnpm workspaces and Turborepo:
   - `apps/api`: Hono HTTP API. Runs on Cloudflare Workers now and on Node in a container later, so keep runtime-specific code in thin adapters (`src/runtime/workers.ts`, later `src/runtime/node.ts`).
   - `apps/web`: React + Vite SPA.
   - `packages/core`: the `RecapData` contract (Zod schema + inferred types) and pure aggregation functions. No I/O.
   - `packages/lastfm`: typed Last.fm client with an injected `fetch`.
   - `packages/templates`: card layouts.
2. **Rendering on the client in Track A.** Cloudflare Workers Free allows 10 ms of CPU per request, too little for server-side PNG rendering. The browser renders the card and exports the PNG. The API only returns aggregated JSON and proxies images (cross-origin images would taint the canvas).
3. **Templates are portable.** Template components use only the subset of JSX and CSS that Satori supports (flexbox, inline styles, TTF fonts, absolute image URLs). A test renders every template through Satori. In Track B the server renders the same components with Satori + resvg.
4. **Cache by month immutability.** A closed month never changes: cache it with no TTL. The current month gets a 1 hour TTL. Cache keys include the schema version.
5. **Free-tier limits are design inputs**: 100k requests/day per Cloudflare account, 10 ms CPU, 50 subrequests per request. The API key for Last.fm lives only on the server.
6. **Two deploy tracks.** Track A (now): Cloudflare Workers + static assets + KV. Track B (later): OCI Always Free ARM VM with k3s, Terraform, Helm, Argo CD, GHCR, Trivy. The same code serves both.

## Card template architecture (hard requirement)

Users will pick among several layouts and customize them. Future layouts must ship without touching `apps/api`. ADR-0003 must describe this shape:

```ts
type DataFeature = "minutes" | "activity" | "artistImages";

interface CardFormat { id: "story" | "square"; width: number; height: number }

interface TemplateDefinition<O> {
  id: string;                 // "classic"
  version: number;            // bump on breaking visual or options changes
  name: string;
  formats: CardFormat[];
  requires: DataFeature[];    // web app turns this into ?include= on /api/recap
  options: z.ZodType<O>;      // drives the auto-generated customization panel
  defaults: O;
  Component: (props: { data: RecapData; options: O; format: CardFormat }) => JSX.Element;
}
```

- A registry exposes `listTemplates()`, `getTemplate(id, version?)` and `requiredFeatures(id)`.
- The API knows nothing about templates. It returns `RecapData` with only the optional features requested.
- Customization state lives in the URL (`?t=classic@1&f=story&o=<base64url JSON>`) and gets validated against the template's options schema on load. Keeping old versions registered keeps old shared links working.
- Design tokens (color, type scale, spacing) are the knobs options can override.

## Stack

TypeScript (strict), pnpm, Turborepo, Hono, React + Vite, Zod, Vitest, Playwright, Biome, commitlint + lefthook, Wrangler, Renovate. Use the current stable major of each. Check versions with `npm view <pkg> version` and check APIs with the context7 MCP before writing config. Do not trust your memory for Wrangler, Hono, Biome or Zod config formats. Pin Node to the current Active LTS in `mise.toml` and `packageManager`.

My environment: WSL2 (Arch Linux) on Windows, zsh, `gh` authenticated. Use LF line endings.

## How we work

- **GitHub issues are the source of truth.** I already ran `scripts/backlog/bootstrap.mjs`, which created labels, milestones M0 to M4 and the issues. Every issue has Tasks, Acceptance criteria and a "Depends on" section.
- `.claude/commands/next.md` (`/next`) suggests the next unblocked issue. `.claude/commands/issue.md` (`/issue <n>`) implements one issue on its own branch and opens a PR. Follow `issue.md` for every issue, including its "stop and wait for approval" step.
- One issue, one branch, one PR. Conventional Commits with the area as scope.
- Tests come with the code. Last.fm behaviour gets tested against captured fixtures, never guessed payloads.
- Secrets: `LASTFM_API_KEY` lives in `.dev.vars` (git-ignored). Never print it, commit it or read `.dev.vars` into context.
- Write prose in docs plainly: short sentences, no marketing tone, no em dashes.

## This session

### Step 0: check the ground (no edits)
1. `gh auth status`, `git remote -v`, `git status`, and list the repo tree.
2. Confirm `.claude/commands/next.md` and `.claude/commands/issue.md` exist.
3. `gh issue list --milestone "M0 · Foundation" --state open` and show me the list.
4. Tell me which Claude Code plugins and MCP servers you have available right now (context7 and Playwright matter most). If something is missing, tell me the install command and wait.

### Step 1: work through M0
Run the `/issue` workflow for each M0 issue in this order, stopping after each PR for my review and merge:

1. "Set up pnpm + Turborepo monorepo skeleton"
2. "Add Biome, commitlint and git hooks"
3. "Create CLAUDE.md and Claude Code project settings"
4. "Write initial ADRs 0001 to 0004"
5. "CI pipeline: lint, typecheck, test, build"
6. "Add Renovate and issue/PR templates"

Notes for specific issues:

- **CLAUDE.md** is for future sessions of you, not for humans. Include: one-paragraph purpose, directory map, the exact commands (`pnpm turbo ...`, `wrangler dev`, fixture capture), architecture invariants (the numbered decisions above, one line each, linking the ADRs), conventions, and a "never do" list (commit secrets, invent Last.fm payloads, put template knowledge in the API, use CSS that Satori cannot render in templates, skip tests). Keep it under 200 lines; link to ADRs instead of repeating them.
- **`.claude/settings.json`**: allow `pnpm`, `npx wrangler`, `git`, `gh` and read-only shell tools; deny `Read(./.dev.vars)` and `Read(./**/.env*)`. Add a PostToolUse hook that runs Biome format on files you edit, if Biome's CLI supports formatting a single file (check first).
- **ADRs** use MADR. ADR-0003 includes the `TemplateDefinition` sketch above and a section on how template versions keep shared URLs stable.
- **CI**: least-privilege `permissions`, actions pinned by commit SHA, pnpm store and `.turbo` cached, concurrency cancel. Print the `gh api` command to protect `main`; I will run it myself.

### Done means
All six M0 issues are closed by merged PRs, `pnpm turbo lint typecheck test build` passes on `main`, and `/next` points to the first M1 issue.
