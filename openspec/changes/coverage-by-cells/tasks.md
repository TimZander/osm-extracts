# Tasks

## 1. Cells a polygon covers

- [ ] 1.1 Tests first, citing "Each region lists the cells it covers" and "A clipped region covers its bounds' cells": the rectangle on cell lines (144 cells), a sliver, an edge-only and a corner-only contact, a hole holding a whole cell, a clipped rectangle, sorted output. Seen to fail, then the function in `src/poly.mjs`; verify `npm test`

## 2. The region job

- [ ] 2.1 Tests first: the built entry has `coverage` from the fixture polygon (`test/fixtures/sample.poly`), including an empty covered cell and excluding a cell with a file outside the polygon; the summary shows the coverage count. Seen to fail, then `src/build-region.mjs`; verify `npm test`

## 3. The deploy job

- [ ] 3.1 Tests first, citing "The deploy job accepts only well-formed region trees" and "A failed region keeps its previous files": an artifact with no `coverage`, with a bad id, with a duplicate fails naming the region; a kept entry keeps its `coverage`, or its lack of one; the manifest's `coverage` is sorted. Seen to fail, then `src/assemble-site.mjs`; verify `npm test`

## 4. Review and decisions

- [ ] 4.1 `/sdd:conformance-review coverage-by-cells`, findings routed with `/sdd:spec-fix`
- [ ] 4.2 ADR 0020 (coverage by cells, the owner's decision; ADR 0013 marked superseded) and ADR 0021 (design open questions 1–4, once the owner answers), with the index updated
- [ ] 4.3 Scan the diff for private material (this repository is public; only shape facts about garmin-map)

## Workflow follow-up

- Send the manifest shape, an example and the edge rules (design decision 4) to the orchestrator and the garmin-map lane.
- After merge: record the first run's coverage counts in `docs/measurements.md`.
- Archive this change in its own PR after it merges.
