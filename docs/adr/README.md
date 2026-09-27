# Architecture decision records

This folder records the decisions that shape the project, why we made them and
what we gave up. Records use the [MADR 4](https://adr.github.io/madr/) format.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-monorepo-and-portable-hono-api.md) | pnpm and Turborepo monorepo with a runtime-portable Hono API | accepted |
| [0002](0002-client-side-png-rendering.md) | Render the PNG in the browser, keep templates Satori-compatible | accepted |
| [0003](0003-pluggable-card-templates.md) | Pluggable card templates with versioned options and URL state | accepted |
| [0004](0004-cache-by-month-immutability.md) | Cache recaps by month immutability | accepted |

## Writing a new ADR

1. Copy [template.md](template.md) to `NNNN-short-title.md`, using the next
   free number.
2. Fill in every section. List the options you rejected and why.
3. Set `status: proposed` while the PR is open and `accepted` when it merges.
4. Add a row to the index above.

Do not rewrite an accepted ADR to change its decision. Write a new ADR and set
the old one's status to `superseded by ADR-NNNN`. Small corrections and added
links are fine.
