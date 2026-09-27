---
status: accepted
date: 2026-09-27
decision-makers: Ígor José Rodrigues
---

# Pluggable card templates with versioned options and URL state

## Context and Problem Statement

Users pick among several card layouts and customize each one. New layouts
will keep arriving after launch. Shared links must keep rendering the same
card after a layout changes. How do we define templates so that a new layout
ships without touching `apps/api`, customization is validated, and old links
keep working?

## Decision Drivers

- Adding a layout must not require changes in `apps/api`.
- The API should compute costly data (listening minutes, activity, artist
  images) only when the chosen template needs it. Free-tier CPU and
  subrequest limits apply ([ADR-0002](0002-client-side-png-rendering.md)).
- The customization panel should not be hand-built per template.
- Customization must survive a page reload and be shareable as a link.
- A shared link must not break or change meaning when a template evolves.
- Templates must stay renderable by Satori
  ([ADR-0002](0002-client-side-png-rendering.md)).

## Considered Options

- Declarative template definitions in a registry, options as a Zod schema,
  state in the URL
- Hard-coded layouts in the web app with hand-written settings forms
- Templates as data (JSON layout descriptions) interpreted by one renderer
- Customization stored on the server behind a short id

## Decision Outcome

Chosen option: "Declarative template definitions in a registry, options as a
Zod schema, state in the URL", because it keeps the API unaware of templates,
generates the customization panel, and needs no server storage.

### Template contract

Each template is a module in `packages/templates` that exports one definition.
Sketch (exact types land in #16):

```ts
type DataFeature = "minutes" | "activity" | "artistImages";

interface CardFormat {
  id: "story" | "square";
  width: number;
  height: number;
}

interface TemplateDefinition<O> {
  id: string; // "classic"
  version: number; // bump on breaking visual or options changes
  name: string;
  formats: CardFormat[];
  requires: DataFeature[]; // web app turns this into ?include= on /api/recap
  options: z.ZodType<O>; // drives the auto-generated customization panel
  defaults: O;
  Component: (props: {
    data: RecapData;
    options: O;
    format: CardFormat;
  }) => React.JSX.Element;
}
```

- `DataFeature` and `RecapData` come from `packages/core` (#7).
- `Component` receives only `RecapData`, never Last.fm payloads.
- `options` describes what users can change. The web app walks the schema to
  build the customization panel: enums become selects, booleans become
  toggles, colors become color pickers.
- Options override design tokens (color, type scale, spacing) rather than
  raw CSS values, so every template shares one set of knobs (#17).

### Registry

`packages/templates` exposes:

- `listTemplates()`: the latest version of each template, for the picker.
- `getTemplate(id, version?)`: a specific version, or the latest when the
  version is omitted.
- `requiredFeatures(id)`: the `DataFeature` list of a template.

The web app calls `/api/recap?...&include=<features>` with the result of
`requiredFeatures`. The API returns `RecapData` with only those optional parts.
It never imports `packages/templates`.

### URL state

The card state lives in the query string:

```
?t=classic@1&f=story&o=<base64url JSON>
```

- `t` is the template id and version. Without `@<version>` the latest version
  is used.
- `f` is the format id.
- `o` is the options object as JSON, base64url encoded. Only values that
  differ from `defaults` are written, to keep links short.

On load the web app decodes `o`, merges it over `defaults` and validates the
result with the template's `options` schema. Invalid or unknown input falls
back to defaults and shows a notice. It never breaks the page.

### How versions keep shared URLs stable

A link records the template version it was made with. The registry keeps
every published version, so `getTemplate("classic", 1)` still returns version 1
after version 2 ships. The link renders the layout and options it was created
with.

Rules for authors:

- Bump `version` when a change would alter how an existing link looks or
  would make its options invalid: removing or renaming an option, changing an
  option's type or meaning, or changing the layout visibly.
- Do not bump for changes old links cannot notice: a new option with a
  default, a bug fix that does not change the design.
- A new version is a new definition. Copy the component and keep the old one
  registered. Share code through helpers rather than editing the old version.
- `listTemplates()` shows only the latest version, so old versions stay
  reachable by link but out of the picker.
- Removing an old version breaks its links. Treat it as a breaking change and
  record it in an ADR.

### Consequences

- Good, because a new layout is a new module and one registry entry. No API
  change.
- Good, because the API computes only the features a template requests.
- Good, because the options schema is the single source for validation,
  defaults and the panel.
- Good, because links need no database and work across deploys.
- Bad, because old template versions accumulate in the bundle. Lazy loading
  per template may be needed later.
- Bad, because a generated panel is less polished than a hand-built one.
  Schemas may need UI hints (labels, ranges) through Zod metadata.
- Bad, because very large option objects make long URLs.

### Confirmation

- `apps/api` has no dependency on `@recap/templates`. Review checks this; a
  lint rule can enforce it later.
- Tests for the registry cover `getTemplate` with and without a version and
  `requiredFeatures` (#16).
- Every registered version renders through Satori in a test
  ([ADR-0002](0002-client-side-png-rendering.md)).
- A test decodes a link from each published version and checks it still
  validates.

## Pros and Cons of the Options

### Declarative definitions, Zod options, URL state

- Good, because it fits the drivers above.
- Bad, because the contract and the panel generator are upfront work before
  the first template.

### Hard-coded layouts and settings forms

- Good, because it is the fastest way to ship one layout.
- Bad, because every layout needs its own form and its own data wiring.
- Bad, because nothing stops the API from growing layout-specific logic.

### Templates as JSON layout data

- Good, because layouts could be added without a deploy.
- Bad, because it means building and maintaining a layout language and its
  renderer.
- Bad, because it gives up type checking of templates.

### Customization stored on the server

- Good, because links are short.
- Bad, because it needs a database and write quota, which conflicts with the
  KV write limit ([ADR-0004](0004-cache-by-month-immutability.md)).
- Bad, because stored state must be migrated when a template changes.

## More Information

- Template contract and registry: #16. Design tokens: #17. Picker and panel:
  #22. Second template to test this contract: #24. Shareable recap URLs: #29.
- If the second template needs contract changes, update this ADR (#24).
