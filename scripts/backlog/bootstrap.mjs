#!/usr/bin/env node
/**
 * Backlog as code: creates labels, milestones and issues on GitHub using the gh CLI.
 * Safe to re-run. Issues are matched by a hidden `backlog-key` marker in the body,
 * so renaming an issue on GitHub will not create a duplicate.
 *
 * Usage:
 *   node scripts/backlog/bootstrap.mjs --dry-run            # show what would change
 *   node scripts/backlog/bootstrap.mjs                      # apply
 *   node scripts/backlog/bootstrap.mjs --project            # also create/fill a Project board
 *   node scripts/backlog/bootstrap.mjs --repo owner/name    # target another repo
 *
 * Requirements: gh >= 2.40 authenticated (`gh auth status`).
 * --project needs the project scope: `gh auth refresh -s project`.
 */
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const WITH_PROJECT = argv.includes("--project");
const repoFlag = argv.indexOf("--repo");
const PROJECT_TITLE = "Recap roadmap";

// ---------------------------------------------------------------------------
// gh helpers
// ---------------------------------------------------------------------------
function gh(args, { input } = {}) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "inherit"],
  }).trim();
}

function ghWrite(args, opts) {
  if (DRY) {
    console.log(`  [dry-run] gh ${args.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")}`);
    return "";
  }
  return gh(args, opts);
}

const REPO =
  repoFlag >= 0 ? argv[repoFlag + 1] : gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
const OWNER = REPO.split("/")[0];

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------
const LABELS = [
  ["type:feat", "1f883d", "New user-facing or API capability"],
  ["type:chore", "8c959f", "Tooling, config, housekeeping"],
  ["type:docs", "0969da", "Documentation and ADRs"],
  ["type:test", "bf8700", "Tests and fixtures"],
  ["type:ci", "6639ba", "CI/CD pipelines"],
  ["type:infra", "953800", "Infrastructure and runtime config"],
  ["type:spike", "d4a72c", "Time-boxed investigation that ends in a decision"],
  ["type:epic", "cf222e", "Large body of work, split into issues later"],
  ["area:repo", "d0d7de", "Monorepo, tooling, Claude Code setup"],
  ["area:core", "c5def5", "packages/core: contract and aggregation"],
  ["area:lastfm", "c5def5", "packages/lastfm: API client"],
  ["area:api", "c5def5", "apps/api: Hono service"],
  ["area:web", "c5def5", "apps/web: SPA"],
  ["area:templates", "c5def5", "packages/templates: card layouts"],
  ["area:ci", "c5def5", "GitHub Actions"],
  ["area:infra", "c5def5", "Cloudflare, OCI, Terraform, k8s"],
  ["area:docs", "c5def5", "README, ADRs"],
  ["priority:p1", "b60205", "Do next"],
  ["priority:p2", "fbca04", "Soon"],
  ["priority:p3", "0e8a16", "Later"],
  ["size:S", "ededed", "Up to half a day"],
  ["size:M", "ededed", "One or two days"],
  ["size:L", "ededed", "More than two days, consider splitting"],
];

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------
const MILESTONES = {
  M0: ["M0 · Foundation", "Monorepo, tooling, CI, ADRs and the Claude Code workflow."],
  M1: ["M1 · Data layer", "Last.fm client, RecapData contract, aggregation and the /api/recap endpoint."],
  M2: ["M2 · Card templates", "Template contract, first layouts, preview, PNG export and customization."],
  M3: ["M3 · Production (Track A)", "Cloudflare Workers deploy, cache, rate limiting, CD and observability."],
  M4: ["M4 · Platform (Track B)", "OCI + k3s + Terraform + Argo CD. Epics, split before starting."],
};

// ---------------------------------------------------------------------------
// Issues. `deps` refer to keys of earlier issues and render as "#<number>".
// ---------------------------------------------------------------------------
const ISSUES = [
  // ======================= M0 · Foundation =======================
  {
    key: "M0-01",
    ms: "M0",
    title: "Set up pnpm + Turborepo monorepo skeleton",
    labels: ["type:chore", "area:repo", "priority:p1", "size:M"],
    body: `## Context
Layout decided in ADR-0001: two apps and three shared packages, TypeScript everywhere.

## Tasks
- [ ] pnpm workspaces: \`apps/web\`, \`apps/api\`, \`packages/core\`, \`packages/lastfm\`, \`packages/templates\`
- [ ] \`tsconfig.base.json\` with \`strict\`, \`noUncheckedIndexedAccess\`, \`exactOptionalPropertyTypes\`
- [ ] Turborepo tasks: \`build\`, \`dev\`, \`lint\`, \`typecheck\`, \`test\`
- [ ] Pin Node (current Active LTS) and pnpm via \`packageManager\` and \`mise.toml\`
- [ ] Each package exports a placeholder and builds

## Acceptance criteria
- On a clean clone, \`pnpm install && pnpm turbo build typecheck\` passes
- No app code beyond placeholders`,
  },
  {
    key: "M0-02",
    ms: "M0",
    title: "Add Biome, commitlint and git hooks",
    labels: ["type:chore", "area:repo", "priority:p1", "size:S"],
    deps: ["M0-01"],
    body: `## Tasks
- [ ] Biome for lint and format at the root, wired into \`turbo lint\`
- [ ] commitlint with Conventional Commits; scopes match the \`area:*\` labels
- [ ] lefthook: format staged files on pre-commit, commitlint on commit-msg
- [ ] \`.editorconfig\` and \`.gitattributes\` (LF line endings, WSL friendly)

## Acceptance criteria
- A commit named \`wip\` fails; \`feat(core): add schema\` passes
- \`pnpm turbo lint\` passes on the skeleton`,
  },
  {
    key: "M0-03",
    ms: "M0",
    title: "Create CLAUDE.md and Claude Code project settings",
    labels: ["type:chore", "area:repo", "priority:p1", "size:S"],
    deps: ["M0-01"],
    body: `## Tasks
- [ ] \`CLAUDE.md\` under 200 lines: purpose, layout, commands, conventions, architecture invariants, never-do list
- [ ] \`.claude/settings.json\`: allow \`pnpm\`, \`git\`, \`gh\`; deny reading \`.dev.vars\` and \`.env*\`
- [ ] Confirm \`/next\` and \`/issue\` commands in \`.claude/commands/\` work against this repo
- [ ] \`.dev.vars.example\` with \`LASTFM_API_KEY=\` and \`.dev.vars\` in \`.gitignore\`

## Acceptance criteria
- A fresh Claude Code session can answer "how do I run the tests?" from CLAUDE.md alone`,
  },
  {
    key: "M0-04",
    ms: "M0",
    title: "Write initial ADRs 0001 to 0004",
    labels: ["type:docs", "area:docs", "priority:p1", "size:M"],
    deps: ["M0-01"],
    body: `## Context
Record decisions before code depends on them. MADR format in \`docs/adr/\`.

## Tasks
- [ ] ADR-0001: pnpm/Turborepo monorepo and a runtime-portable API with Hono (Workers now, Node container later)
- [ ] ADR-0002: PNG rendering on the client for Track A; templates restricted to a Satori-compatible subset so Track B can render on the server
- [ ] ADR-0003: pluggable card template architecture (contract, registry, versioning, options schema, URL state)
- [ ] ADR-0004: cache strategy: closed months are immutable, current month has a short TTL
- [ ] \`docs/adr/README.md\` index and a \`template.md\`

## Acceptance criteria
- Each ADR lists context, decision, alternatives considered and consequences`,
  },
  {
    key: "M0-05",
    ms: "M0",
    title: "CI pipeline: lint, typecheck, test, build",
    labels: ["type:ci", "area:ci", "priority:p1", "size:M"],
    deps: ["M0-02"],
    body: `## Tasks
- [ ] Workflow on \`pull_request\` and \`push\` to \`main\`
- [ ] Cache the pnpm store and \`.turbo\`
- [ ] \`concurrency\` group that cancels superseded runs
- [ ] \`permissions: contents: read\` at the top; third-party actions pinned by commit SHA
- [ ] Job summary with the turbo task results
- [ ] Document the \`gh api\` call that protects \`main\` and requires the CI check

## Acceptance criteria
- A PR with a type error goes red; a clean PR goes green in under 3 minutes with warm cache`,
  },
  {
    key: "M0-06",
    ms: "M0",
    title: "Add Renovate and issue/PR templates",
    labels: ["type:chore", "area:repo", "priority:p3", "size:S"],
    deps: ["M0-05"],
    body: `## Tasks
- [ ] \`renovate.json\`: group minor/patch weekly, pin GitHub Actions digests, automerge devDependency patches when CI passes
- [ ] \`.github/ISSUE_TEMPLATE/\` forms for feature, bug and spike, using the same sections as the backlog issues
- [ ] \`.github/pull_request_template.md\`: summary, how it was tested, screenshots, \`Closes #\`

## Acceptance criteria
- Renovate opens its onboarding PR and the config validates`,
  },

  // ======================= M1 · Data layer =======================
  {
    key: "M1-01",
    ms: "M1",
    title: "Define the RecapData v1 contract with Zod",
    labels: ["type:feat", "area:core", "priority:p1", "size:M"],
    deps: ["M0-01"],
    body: `## Context
RecapData is the only thing the API and the templates share. Templates never see Last.fm payloads.

## Tasks
- [ ] \`schemaVersion: 1\`, \`user\`, \`period\` (year, month, timezone, from, to)
- [ ] \`totals\`: scrobbles, uniqueArtists, uniqueTracks, optional \`estimatedMinutes\`
- [ ] \`topArtists\`, \`topTracks\`, \`topAlbums\` with playcount and optional image URL
- [ ] optional \`activity\`: byWeekday[7], byHour[24], peakDay
- [ ] \`DataFeature\` union naming the optional, costly parts (\`minutes\`, \`activity\`, \`artistImages\`)
- [ ] Export inferred types; tests for valid and invalid samples

## Acceptance criteria
- \`packages/core\` exports schema + types; no runtime dependency besides Zod`,
  },
  {
    key: "M1-02",
    ms: "M1",
    title: "Capture real Last.fm fixtures",
    labels: ["type:test", "area:lastfm", "priority:p1", "size:S"],
    deps: ["M0-03"],
    body: `## Context
Tests must run against real payloads, not guessed shapes.

## Tasks
- [ ] \`pnpm fixtures:capture --user <name> --month YYYY-MM\` reads \`LASTFM_API_KEY\` from \`.dev.vars\`
- [ ] Save raw JSON for: user.getInfo, getRecentTracks (2 pages), weekly artist/track/album charts, track.getInfo
- [ ] Save error payloads: user not found (6), and one private-history profile if you can find it
- [ ] Commit fixtures under \`packages/lastfm/test/fixtures/\` with a README on how they were captured

## Acceptance criteria
- The key never appears in fixtures or git history`,
  },
  {
    key: "M1-03",
    ms: "M1",
    title: "Spike: do weekly chart methods accept arbitrary from/to ranges?",
    labels: ["type:spike", "area:lastfm", "priority:p1", "size:S"],
    deps: ["M1-02"],
    body: `## Question
Can \`user.getWeekly*Chart\` return a calendar month (e.g. Aug 1 to Aug 31) or only the week boundaries from \`getWeeklyChartList\`?

## Tasks
- [ ] Compare weekly chart results against counts computed from getRecentTracks for the same month
- [ ] Test a range that starts mid-week

## Outcome
- ADR-0005 with the answer and the chosen data source for top lists`,
  },
  {
    key: "M1-04",
    ms: "M1",
    title: "Typed Last.fm client",
    labels: ["type:feat", "area:lastfm", "priority:p1", "size:L"],
    deps: ["M1-02"],
    body: `## Tasks
- [ ] Methods: user.getInfo, getRecentTracks (paginated, drops now-playing), weekly artist/track/album charts, track.getInfo
- [ ] Parse responses with Zod; normalize the Last.fm quirks (single item vs array, "#text" keys, string numbers)
- [ ] Typed errors: UserNotFound (6), PrivateProfile (17), RateLimited (29), Upstream
- [ ] Retry with exponential backoff + jitter on 29 and 5xx
- [ ] Inject \`fetch\` so the client runs on Workers and Node
- [ ] Unit tests against fixtures

## Acceptance criteria
- No \`any\`; coverage above 90% for the package`,
  },
  {
    key: "M1-05",
    ms: "M1",
    title: "Month aggregation in core",
    labels: ["type:feat", "area:core", "priority:p1", "size:M"],
    deps: ["M1-01", "M1-02"],
    body: `## Tasks
- [ ] Month boundaries in the user's IANA timezone, converted to Unix seconds for the API
- [ ] Totals, top N, byWeekday, byHour, peakDay computed in the user's timezone
- [ ] Pure functions: input normalized scrobbles, output RecapData

## Acceptance criteria
- Test: a scrobble at 23:30 on Aug 31 in America/Sao_Paulo counts for August
- Test: a DST month in America/New_York has correct hourly buckets`,
  },
  {
    key: "M1-06",
    ms: "M1",
    title: "GET /api/recap endpoint with Hono",
    labels: ["type:feat", "area:api", "priority:p1", "size:M"],
    deps: ["M1-04", "M1-05"],
    body: `## Tasks
- [ ] \`GET /api/recap?user=&month=YYYY-MM&tz=&include=minutes,activity\` validated with Zod
- [ ] Errors as \`application/problem+json\` (RFC 9457) mapped from client errors
- [ ] Request id header and one structured JSON log line per request
- [ ] \`GET /api/health\`
- [ ] Integration tests with a mocked fetch

## Acceptance criteria
- Unknown user returns 404 problem+json; private profile returns 403 with a clear message`,
  },
  {
    key: "M1-07",
    ms: "M1",
    title: "Estimated listening minutes",
    labels: ["type:feat", "area:api", "priority:p2", "size:M"],
    deps: ["M1-06"],
    body: `## Context
Scrobbles carry no duration. track.getInfo sometimes returns 0.

## Tasks
- [ ] Only runs when \`include=minutes\`
- [ ] Look up durations for the tracks that cover most plays, cap the number of calls per request
- [ ] Fallback average for missing durations; mark \`estimatedMinutes\` as estimated
- [ ] Duration cache behind an interface (KV implementation lands in M3)`,
  },
  {
    key: "M1-08",
    ms: "M1",
    title: "Artist images via the Deezer API",
    labels: ["type:feat", "area:api", "priority:p2", "size:S"],
    deps: ["M1-06"],
    body: `## Context
Last.fm returns a placeholder star for artist images.

## Tasks
- [ ] \`include=artistImages\` looks up the top N artists on Deezer search
- [ ] Exact-name match first, then best match; null when unsure
- [ ] Templates handle null with a generated fallback (initials or album cover)`,
  },
  {
    key: "M1-09",
    ms: "M1",
    title: "Subrequest budget strategy for heavy users",
    labels: ["type:feat", "area:api", "priority:p2", "size:M"],
    deps: ["M1-03", "M1-06"],
    body: `## Context
Workers Free allows 50 subrequests per request. A user with 20k scrobbles in a month needs 100 pages of getRecentTracks.

## Tasks
- [ ] Measure calls per request for light, typical and heavy fixtures
- [ ] Pick a strategy (weekly charts for tops, client-driven batches for activity, or a queue) and implement it
- [ ] ADR-0006 with the numbers`,
  },

  // ======================= M2 · Card templates =======================
  {
    key: "M2-01",
    ms: "M2",
    title: "Template contract and registry",
    labels: ["type:feat", "area:templates", "priority:p1", "size:M"],
    deps: ["M1-01"],
    body: `## Context
Users will choose among layouts and customize them. See ADR-0003.

## Tasks
- [ ] \`TemplateDefinition\`: id, version, name, formats (story 1080x1920, square 1080x1080), \`requires: DataFeature[]\`, \`options\` Zod schema, \`defaults\`, \`Component\`
- [ ] Registry with \`getTemplate(id, version?)\` and \`listTemplates()\`
- [ ] \`requiredFeatures(templateId)\` so the web app builds the \`include\` param
- [ ] Vitest check that renders every template x format through Satori and fails on unsupported CSS

## Acceptance criteria
- Adding a template means adding one folder and one registry line`,
  },
  {
    key: "M2-02",
    ms: "M2",
    title: "Design tokens and vendored fonts",
    labels: ["type:feat", "area:templates", "priority:p2", "size:S"],
    deps: ["M2-01"],
    body: `## Tasks
- [ ] Tokens for color, type scale and spacing that options can override
- [ ] Vendored TTF fonts (Satori cannot read woff2) with licenses in the repo
- [ ] One font loader shared by the web preview and the Satori test`,
  },
  {
    key: "M2-03",
    ms: "M2",
    title: "First template: classic story (9:16)",
    labels: ["type:feat", "area:templates", "priority:p1", "size:M"],
    deps: ["M2-01", "M2-02"],
    body: `## Tasks
- [ ] Original layout: header with user and month, top 5 artists, top 5 tracks, top album cover, totals
- [ ] Options: accent color, background style, show/hide sections
- [ ] Long names truncate cleanly; missing images fall back

## Acceptance criteria
- Renders with light, typical and heavy fixtures without overflow`,
  },
  {
    key: "M2-04",
    ms: "M2",
    title: "Web app shell: form, loading and error states",
    labels: ["type:feat", "area:web", "priority:p1", "size:M"],
    deps: ["M1-06"],
    body: `## Tasks
- [ ] React + Vite app; form with username, month picker (no future months), timezone (browser default)
- [ ] Loading state, and messages for each problem+json type
- [ ] Typed API client using the core schema

## Acceptance criteria
- Keyboard-only flow works; Lighthouse accessibility score of 95 or more`,
  },
  {
    key: "M2-05",
    ms: "M2",
    title: "Image proxy endpoint",
    labels: ["type:feat", "area:api", "priority:p1", "size:S"],
    deps: ["M1-06"],
    body: `## Context
Cross-origin images taint the canvas and break PNG export.

## Tasks
- [ ] \`GET /img?url=\` with a host allowlist (Last.fm and Deezer CDNs)
- [ ] Size limit, content-type check, long cache headers, CORS header
- [ ] Reject everything else with 400`,
  },
  {
    key: "M2-06",
    ms: "M2",
    title: "Card preview and PNG export",
    labels: ["type:feat", "area:web", "priority:p1", "size:M"],
    deps: ["M2-03", "M2-04", "M2-05"],
    body: `## Tasks
- [ ] Scaled preview of the selected template
- [ ] Export at exact pixel size (1080x1920) after fonts and images load
- [ ] Download button and Web Share API with a file, falling back to download

## Acceptance criteria
- Exported PNG dimensions match the format on desktop Chrome, Firefox and Android Chrome`,
  },
  {
    key: "M2-07",
    ms: "M2",
    title: "Template picker and customization panel",
    labels: ["type:feat", "area:web", "priority:p2", "size:L"],
    deps: ["M2-06"],
    body: `## Tasks
- [ ] Picker lists registered templates with thumbnails
- [ ] Panel generated from the template's options schema (color, select, toggle)
- [ ] State in the URL: \`?t=classic@1&f=story&o=<base64url JSON>\`, validated on load
- [ ] Reset to defaults

## Acceptance criteria
- Reloading a customized URL renders the same card`,
  },
  {
    key: "M2-08",
    ms: "M2",
    title: "Visual regression tests per template",
    labels: ["type:test", "area:templates", "priority:p2", "size:M"],
    deps: ["M2-06"],
    body: `## Tasks
- [ ] Playwright screenshot per template x format with fixed fixture data and fonts
- [ ] Run in CI; upload the diff as an artifact on failure`,
  },
  {
    key: "M2-09",
    ms: "M2",
    title: "Second template to validate the abstraction",
    labels: ["type:feat", "area:templates", "priority:p2", "size:M"],
    deps: ["M2-07"],
    body: `## Tasks
- [ ] A layout with a different structure (grid of covers or big-number poster) and the square format
- [ ] Write down every change the contract needed; update ADR-0003 if any

## Acceptance criteria
- No change to apps/api to ship it`,
  },

  // ======================= M3 · Production (Track A) =======================
  {
    key: "M3-01",
    ms: "M3",
    title: "Wrangler setup: environments and secrets",
    labels: ["type:infra", "area:infra", "priority:p1", "size:S"],
    deps: ["M1-06"],
    body: `## Tasks
- [ ] \`wrangler.jsonc\` with \`preview\` and \`production\` environments
- [ ] Static assets for the SPA served by the same Worker
- [ ] \`LASTFM_API_KEY\` via \`wrangler secret\`; KV namespaces declared per environment
- [ ] Separate Cloudflare account for this project (the free request limit is per account)`,
  },
  {
    key: "M3-02",
    ms: "M3",
    title: "KV cache with month immutability",
    labels: ["type:feat", "area:api", "priority:p1", "size:M"],
    deps: ["M3-01"],
    body: `## Tasks
- [ ] Key: \`recap:v{schema}:{user lowercased}:{YYYY-MM}:{tz}:{sorted features}\`
- [ ] Closed months: no TTL. Current month: 1 hour
- [ ] Track duration cache from M1-07 moves to KV
- [ ] \`x-cache: hit|miss\` response header

## Acceptance criteria
- A second request for a closed month makes zero calls to Last.fm`,
  },
  {
    key: "M3-03",
    ms: "M3",
    title: "Rate limiting per IP",
    labels: ["type:feat", "area:api", "priority:p2", "size:S"],
    deps: ["M3-01"],
    body: `## Tasks
- [ ] Limit uncached recap requests per IP (Workers rate limiting binding or KV counter)
- [ ] 429 problem+json with \`retry-after\``,
  },
  {
    key: "M3-04",
    ms: "M3",
    title: "Continuous deployment: PR previews and production",
    labels: ["type:ci", "area:ci", "priority:p1", "size:M"],
    deps: ["M3-01", "M0-05"],
    body: `## Tasks
- [ ] Deploy a preview on each PR and comment the URL
- [ ] Deploy production on merge to \`main\` through a protected GitHub environment
- [ ] Cloudflare API token scoped to this account's Workers and KV only
- [ ] Smoke test \`/api/health\` after deploy; fail the job if it does not answer`,
  },
  {
    key: "M3-05",
    ms: "M3",
    title: "Shareable recap URLs",
    labels: ["type:feat", "area:web", "priority:p2", "size:M"],
    deps: ["M2-07", "M3-02"],
    body: `## Tasks
- [ ] Route \`/u/:user/:month\` keeping template and options in the query string
- [ ] Static Open Graph image for now; per-recap OG images move to Track B (M4)`,
  },
  {
    key: "M3-06",
    ms: "M3",
    title: "Observability: structured logs and error alerts",
    labels: ["type:infra", "area:infra", "priority:p2", "size:M"],
    deps: ["M3-04"],
    body: `## Tasks
- [ ] JSON logs with request id, route, status, duration, cache status, upstream calls
- [ ] Workers Logs enabled; free-tier error tracking with source maps
- [ ] A saved query or small dashboard: cache hit ratio, p95 latency, Last.fm error rate`,
  },
  {
    key: "M3-07",
    ms: "M3",
    title: "Portfolio README",
    labels: ["type:docs", "area:docs", "priority:p1", "size:M"],
    deps: ["M3-04"],
    body: `## Tasks
- [ ] Demo GIF and live link
- [ ] Architecture diagram (Mermaid) and ADR index
- [ ] Cost table (zero) and the free-tier limits you designed around
- [ ] Known limits and Last.fm attribution`,
  },
  {
    key: "M3-08",
    ms: "M3",
    title: "Privacy and attribution page",
    labels: ["type:docs", "area:web", "priority:p3", "size:S"],
    deps: ["M2-04"],
    body: `## Tasks
- [ ] What data you fetch, what you cache and for how long, how to request removal
- [ ] Last.fm and Deezer attribution`,
  },

  // ======================= M4 · Platform (Track B) =======================
  {
    key: "M4-01",
    ms: "M4",
    title: "Epic: containerize the API with the Hono Node adapter",
    labels: ["type:epic", "area:infra", "priority:p3"],
    deps: ["M3-04"],
    body: `## Scope
- Node entrypoint for the same Hono app; Redis replaces KV behind the cache interface
- Multi-stage Dockerfile, non-root, distroless or alpine; multi-arch (arm64 for OCI Ampere)

Split into issues before starting.`,
  },
  {
    key: "M4-02",
    ms: "M4",
    title: "Epic: Terraform for OCI and Cloudflare",
    labels: ["type:epic", "area:infra", "priority:p3"],
    deps: ["M4-01"],
    body: `## Scope
- OCI Ampere A1 VM sized to 2 OCPU / 12 GB, VCN with no public ingress, budget alert
- Cloudflare Tunnel and DNS
- Remote state, modules, \`terraform plan\` on PR

Split into issues before starting.`,
  },
  {
    key: "M4-03",
    ms: "M4",
    title: "Epic: k3s, Helm chart and Argo CD",
    labels: ["type:epic", "area:infra", "priority:p3"],
    deps: ["M4-02"],
    body: `## Scope
- k3s single node; own Helm chart with probes, resources, HPA
- Argo CD app-of-apps, GitOps repo layout
- Rehearse locally with k3d first

Split into issues before starting.`,
  },
  {
    key: "M4-04",
    ms: "M4",
    title: "Epic: supply-chain-aware pipeline (GHCR, Trivy, OIDC)",
    labels: ["type:epic", "area:ci", "priority:p3"],
    deps: ["M4-01"],
    body: `## Scope
- Build and push to GHCR, Trivy scan that fails on high/critical, SBOM
- Reusable workflows, environment-separated deploys, OIDC instead of long-lived secrets

Split into issues before starting.`,
  },
  {
    key: "M4-05",
    ms: "M4",
    title: "Epic: server-side rendering with Satori and per-recap OG images",
    labels: ["type:epic", "area:templates", "priority:p3"],
    deps: ["M4-01"],
    body: `## Scope
- \`GET /api/card.png\` renders any template server-side with Satori + resvg
- Rendered images cached; OG tags point at them

Split into issues before starting.`,
  },
  {
    key: "M4-06",
    ms: "M4",
    title: "Epic: observability with Grafana Cloud",
    labels: ["type:epic", "area:infra", "priority:p3"],
    deps: ["M4-03"],
    body: `## Scope
- Metrics, logs and traces from the cluster to Grafana Cloud free tier
- SLO for recap latency and an alert on error budget burn

Split into issues before starting.`,
  },
];

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
function keyMarker(key) {
  return `<!-- backlog-key: ${key} -->`;
}

function main() {
  console.log(`Repo: ${REPO}${DRY ? "  (dry-run)" : ""}\n`);

  // Labels (--force makes this idempotent)
  console.log("Labels");
  for (const [name, color, description] of LABELS) {
    ghWrite(["label", "create", name, "--color", color, "--description", description, "--force", "--repo", REPO]);
  }
  console.log(`  ${LABELS.length} labels ensured\n`);

  // Milestones
  console.log("Milestones");
  const existingMs = new Set(
    gh(["api", `repos/${REPO}/milestones?state=all&per_page=100`, "--paginate", "-q", ".[].title"])
      .split("\n")
      .filter(Boolean),
  );
  for (const [title, description] of Object.values(MILESTONES)) {
    if (existingMs.has(title)) {
      console.log(`  = ${title}`);
      continue;
    }
    ghWrite(["api", `repos/${REPO}/milestones`, "-f", `title=${title}`, "-f", `description=${description}`]);
    console.log(`  + ${title}`);
  }
  console.log("");

  // Existing issues, matched by marker first and title second
  const existing = JSON.parse(
    gh(["issue", "list", "--repo", REPO, "--state", "all", "--limit", "1000", "--json", "number,title,body,url"]) ||
      "[]",
  );
  const numberByKey = new Map();
  const urlByKey = new Map();
  for (const item of ISSUES) {
    const hit =
      existing.find((i) => (i.body || "").includes(keyMarker(item.key))) ||
      existing.find((i) => i.title === item.title);
    if (hit) {
      numberByKey.set(item.key, hit.number);
      urlByKey.set(item.key, hit.url);
    }
  }

  console.log("Issues");
  let created = 0;
  for (const item of ISSUES) {
    if (numberByKey.has(item.key)) {
      console.log(`  = #${numberByKey.get(item.key)} ${item.title}`);
      continue;
    }
    const deps = (item.deps || []).map((k) => {
      if (!numberByKey.has(k)) throw new Error(`${item.key} depends on ${k}, which is defined later or missing`);
      return `- #${numberByKey.get(k)}`;
    });
    const body = [item.body, deps.length ? `\n## Depends on\n${deps.join("\n")}` : "", `\n${keyMarker(item.key)}`]
      .filter(Boolean)
      .join("\n");

    const args = ["issue", "create", "--repo", REPO, "--title", item.title, "--body-file", "-"];
    for (const l of item.labels) args.push("--label", l);
    args.push("--milestone", MILESTONES[item.ms][0]);

    const url = ghWrite(args, { input: body });
    const number = DRY ? `?${item.key}` : Number(url.match(/\/issues\/(\d+)/)?.[1]);
    numberByKey.set(item.key, number);
    urlByKey.set(item.key, url);
    created++;
    console.log(`  + #${number} ${item.title}`);
  }
  console.log(`\n${created} ${DRY ? "would be created" : "created"}, ${ISSUES.length - created} already present`);

  if (WITH_PROJECT) addToProject(urlByKey);
}

function addToProject(urlByKey) {
  console.log("\nProject board");
  const list = JSON.parse(gh(["project", "list", "--owner", OWNER, "--format", "json", "--limit", "100"]));
  let project = list.projects.find((p) => p.title === PROJECT_TITLE);
  if (!project) {
    if (DRY) {
      console.log(`  [dry-run] would create project "${PROJECT_TITLE}" and add ${ISSUES.length} issues`);
      return;
    }
    project = JSON.parse(gh(["project", "create", "--owner", OWNER, "--title", PROJECT_TITLE, "--format", "json"]));
    console.log(`  + ${project.url}`);
  }
  for (const [key, url] of urlByKey) {
    if (!url) continue;
    ghWrite(["project", "item-add", String(project.number), "--owner", OWNER, "--url", url]);
  }
  console.log(`  items ensured in "${PROJECT_TITLE}". Link it to the repo in the project settings.`);
}

main();
