---
status: accepted
date: 2026-09-27
decision-makers: Ígor José Rodrigues
---

# Render the PNG in the browser, keep templates Satori-compatible

## Context and Problem Statement

The product output is a PNG card, 1080x1920 for the story format. Something
has to turn recap data and a template into that image. Track A runs on the
Workers Free plan, which allows 10 ms of CPU time per request. Rendering a
card on the server (layout, text shaping, rasterizing) needs far more than
that. Track B will run on a VM where CPU time is not capped per request. Where
do we render, and how do we avoid rewriting templates when Track B arrives?

## Decision Drivers

- Workers Free: 10 ms CPU per request, 100,000 requests per day per account,
  50 external subrequests per request.
- Zero monthly cost.
- Track B should render the same templates on the server, for example for
  Open Graph images (#37).
- A browser canvas becomes tainted when it draws cross-origin images without
  CORS headers, and a tainted canvas cannot be exported.

## Considered Options

- Render in the browser, API returns JSON and proxies images
- Render on the Worker with Satori and resvg
- Cloudflare Browser Rendering (headless Chrome)
- A separate render service on another host

## Decision Outcome

Chosen option: "Render in the browser, API returns JSON and proxies images",
because it keeps the Worker well inside its CPU budget and costs nothing.

- The API returns aggregated `RecapData` as JSON. It does no rendering.
- The API proxies external images (album art, artist photos) so the browser
  loads them from our origin and the canvas stays exportable (#20).
- The web app renders the card and exports the PNG. The export library is
  chosen in #21.
- Templates are restricted to the subset of JSX and CSS that Satori supports,
  so Track B can render the same components on the server with Satori and
  resvg.

The Satori subset, as rules for template authors:

- Layout with flexbox only. A `div` with more than one child needs an explicit
  `display: flex` (or `contents` or `none`). No grid.
- Inline `style` objects only. No class names, no external stylesheets.
- Fonts are passed in as TTF files. Satori also reads OTF and WOFF, not
  WOFF2; we standardize on TTF.
- Images use absolute URLs.
- No class components, no `dangerouslySetInnerHTML`, no `<text>` inside
  inline SVG.

### Consequences

- Good, because the Worker only aggregates and serializes JSON, which fits
  the CPU limit.
- Good, because rendering costs nothing on our side and scales with users.
- Good, because Track B can reuse the templates without changes.
- Bad, because output can differ slightly between browsers (font
  rasterization, image decoding).
- Bad, because the Satori subset limits what designers can do. No grid, no
  CSS classes, no animations.
- Bad, because the image proxy uses one subrequest per image and must be
  restricted to known image hosts so it is not an open proxy.
- Neutral, because there is no server-side image for link previews until
  Track B.

### Confirmation

- A test renders every registered template, in every format, through Satori
  with fixture data (#16, #18). A template that uses unsupported CSS fails the
  test.
- The API has no dependency on Satori, resvg or any rendering library in
  Track A.

## Pros and Cons of the Options

### Render in the browser

- Good, because it has no server CPU cost.
- Good, because preview and export use the same code path.
- Bad, because it needs the image proxy for cross-origin images.
- Bad, because exported images depend on the user's browser.

### Render on the Worker with Satori and resvg

- Good, because output is identical for every user and can be cached.
- Good, because it enables Open Graph images right away.
- Bad, because rendering a 1080x1920 card takes far more than 10 ms of CPU.
  Requests would fail on the Free plan.
- Bad, because the WASM bundles are large for a Worker.

### Cloudflare Browser Rendering

- Good, because it supports full HTML and CSS.
- Bad, because it adds a quota-limited or paid service and seconds of latency
  per render.

### Separate render service on another host

- Good, because it removes the CPU limit.
- Bad, because it adds a second deployment and a host that must stay free.
- Bad, because it is Track B work pulled into Track A.

## More Information

- Template architecture: [ADR-0003](0003-pluggable-card-templates.md).
- Server-side rendering epic for Track B: #37.
- Satori documentation: https://github.com/vercel/satori
