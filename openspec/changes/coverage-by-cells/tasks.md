# Tasks

## 1. Cells a polygon covers

- [x] 1.1 Tests first, citing "Each region lists the cells it covers", "A clipped region covers its bounds' cells" and "The output is byte-stable": the rectangle on cell lines (144 cells), a sliver, an edge-only and a corner-only contact, a hole holding a whole cell, a rectangle, sorted output with each id once. Seen to fail, then the function in `src/poly.mjs`; verify `npm test`

## 2. The region job

- [x] 2.1 Tests first, citing "Each region lists the cells it covers", "A clipped region covers its bounds' cells", "The manifest describes every region", "Features are filed into 0.25° cells" and "Each region job reports its size": a clipped region's entry has its `bounds`' cells, not its polygon's; the built entry's `coverage` from a polygon the test writes (not `sample.poly`, which other tests depend on), smaller than the data in `sample.osm` so a trail's cell with a file lies outside it, and with an empty covered cell; the summary shows the coverage count. Seen to fail, then `src/build-region.mjs`; verify `npm test`

## 3. The deploy job

- [x] 3.1 Tests first, citing "The deploy job accepts only well-formed region trees", "A failed region keeps its previous files", "The previous site is read from the data branch", "The manifest describes every region" and "The output is byte-stable": the written manifest's entries carry `coverage`; an artifact with no `coverage`, with a bad id, with a duplicate fails naming the region; an artifact with an empty `coverage`, or ids such as `1_2_3` and `01_3`, fails; an artifact's `coverage` out of order is written sorted; a kept entry keeps its `coverage` ids (written sorted, also when kept out of order), or its lack of one; a kept `coverage` that isn't an array of distinct cell ids fails the deploy job. Seen to fail, then `src/assemble-site.mjs`; verify `npm test`

## 4. Review and decisions

- [x] 4.1 `/sdd:conformance-review coverage-by-cells`, findings routed with `/sdd:spec-fix` (verdict: conforms with gaps; M1 fixed with two tests, R1 is design open question 7)
- [x] 4.2 ADR 0020 (coverage by cells, the owner's decision; ADR 0013 marked superseded) and ADR 0021 (design open questions 1–7, proposed until the owner answers), with the index updated
- [x] 4.3 Scan the diff for private material (this repository is public; only shape facts about garmin-map): only generic mentions of garmin-map and the shape it reads

## Workflow follow-up

- Send the manifest shape, an example and the edge rules (design decision 4) to the orchestrator and the garmin-map lane.
- After merge: record the first run's coverage counts in `docs/measurements.md`.
- Archive this change in its own PR after it merges.
