# CLAUDE.md

Guidance for agents working in this repository.

## Spec-driven workflow

@.claude/sdd-workflow.md

## Project

- Node (20+, built-ins only at runtime) and `osmium-tool`. Tests: `npm test` (`node --test`).
- The workflow (`.github/workflows/extract.yml`) is high-risk: changes to it get `/security-review`
  and an attack test. Never push to `data` by hand; only the workflow does.
- `download.geofabrik.de`, `*.pages.dev` and `osm.timzander.com` may be blocked in agent containers;
  use the fixtures in `test/fixtures/`.

<!-- Stack, commands, and rules specific to this repository. -->
