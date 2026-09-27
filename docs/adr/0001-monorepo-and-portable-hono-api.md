---
status: accepted
date: 2026-09-27
decision-makers: Ígor José Rodrigues
---

# pnpm and Turborepo monorepo with a runtime-portable Hono API

## Context and Problem Statement

The project has a browser app, an HTTP API and shared logic: the `RecapData`
contract, the Last.fm client and the card templates. The API must run on
Cloudflare Workers now (Track A) and in a Node container on a k3s cluster later
(Track B). How do we lay out the code, and how do we keep the API independent
of the runtime?

## Decision Drivers

- The web app and the API share types and schemas. They must not drift.
- The same API code must serve Track A and Track B.
- Runs at zero monthly cost, so Track A targets the Workers Free plan.
- Small enough to ship Track A in a few weeks with one developer.
- CI should rebuild and retest only what changed.

## Considered Options

- pnpm workspaces and Turborepo, Hono API with thin runtime adapters
- Separate repositories for the API, the web app and the shared packages
- Nx monorepo
- Express or Fastify API
- Native Workers `fetch` handler without a framework

## Decision Outcome

Chosen option: "pnpm workspaces and Turborepo, Hono API with thin runtime
adapters", because it shares code without publishing packages, keeps tooling
small, and Hono runs on both Workers and Node with the same application code.

Layout:

- `apps/api`: Hono HTTP API.
- `apps/web`: React and Vite SPA.
- `packages/core`: `RecapData` Zod schema, inferred types and pure aggregation.
  No I/O.
- `packages/lastfm`: typed Last.fm client. It takes `fetch` as a parameter.
- `packages/templates`: card templates and their registry (see
  [ADR-0003](0003-pluggable-card-templates.md)).

The API builds one Hono app in a runtime-neutral module. Each runtime gets a
thin adapter that only wires the app to the host:

- `src/runtime/workers.ts` exports the app as the Worker entry point and reads
  bindings (KV, secrets) from the Workers environment.
- `src/runtime/node.ts` (Track B) passes `app.fetch` to `@hono/node-server`
  and reads configuration from the process environment.

Application code depends on small interfaces (cache, fetch, config), not on
Workers or Node APIs. Adapters provide the implementations.

### Consequences

- Good, because a schema change in `packages/core` fails typecheck in both
  apps in the same PR.
- Good, because Turborepo caches tasks and runs only what a change affects.
- Good, because moving to Track B means adding one adapter, not rewriting
  routes.
- Good, because injected `fetch` and cache make the API and the Last.fm client
  easy to test without network access.
- Bad, because adapters add a layer of indirection for a project that runs on
  one runtime today.
- Bad, because some Workers features (KV, `waitUntil`) need an equivalent on
  Node before Track B works.
- Neutral, because Turborepo and pnpm workspaces add some configuration that a
  single package would not need.

### Confirmation

- Only files under `apps/api/src/runtime/` import Workers types or Node
  built-ins. Review checks this; a lint rule can enforce it later.
- `packages/core` has no runtime dependency besides Zod (#7).
- CI runs `pnpm turbo lint typecheck test build` on every PR (#5).

## Pros and Cons of the Options

### pnpm workspaces and Turborepo, Hono with adapters

- Good, because workspace packages are linked locally with `workspace:*`.
- Good, because pnpm is strict about undeclared dependencies.
- Good, because Hono is built on Web standard `Request` and `Response` and has
  official Workers and Node support.
- Bad, because Turborepo is one more tool to learn and configure.

### Separate repositories

- Good, because each repository has a small, focused pipeline.
- Bad, because shared packages need publishing and version bumps for every
  contract change.
- Bad, because a change across the API and web app needs coordinated PRs.

### Nx

- Good, because it offers generators, a project graph and affected commands.
- Bad, because it brings more concepts and configuration than five packages
  need.

### Express or Fastify

- Good, because both are mature with large ecosystems.
- Bad, because neither runs natively on Workers. They depend on Node HTTP
  APIs.

### Native Workers handler without a framework

- Good, because it has no dependencies and minimal startup cost.
- Bad, because routing, validation and error handling would be hand-written.
- Bad, because the code would be tied to the Workers entry point shape.

## More Information

- Two deploy tracks: Track A is Cloudflare Workers with static assets and KV.
  Track B is an OCI Always Free ARM VM with k3s, Terraform, Helm, Argo CD,
  GHCR and Trivy. The same code serves both.
- Monorepo skeleton: #1. Node adapter: #33.
