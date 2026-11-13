# Proposal: british-columbia-region

## Why

The owner said "start working on British Columbia" on 2026-11-13. British Columbia is the fifth
region, after Colorado, Wyoming, Utah and Idaho (ADR 0006: one region at a time), and the first
outside the United States. It is about 945,000 km², more than the four states together, and its
Geofabrik extract is 1.2 GB, three times Colorado's. Coverage by cells (ADRs 0020–0023) says where
it has data, from its own Geofabrik polygon, and the 12 GiB builder heap (ADR 0030, change
download-cause-and-builder-heap) was added so a region this size fits in memory.

## What Changes

- **`regions.json`** gets a fifth entry, `british-columbia` (`British Columbia`, Geofabrik
  `north-america/canada/british-columbia`, not clipped), after `idaho`.
- **British Columbia `bounds`:** 49.01 / -130.00 / 59.99 / -120.01 (south, west, north, east),
  the block from the 49th parallel to the 60th and from the coast to the 120th meridian. The change's
  author chose them (design decision 2, ADR 0032), checked against the real
  `british-columbia.poly` with the repository's own guard. They matter only for the guard and for an
  app that reads nothing but `bounds`.
- **Coverage:** nothing new to build. The job computes `coverage` from `british-columbia.poly`
  (3,467 cells, counted from the real polygon), so Victoria, the Kootenays east of -120, Haida Gwaii
  and the north-west are covered though outside `bounds`.
- **Borders:** the 10 cells Idaho covers along 49° N (rows 195–196, columns -469 to -465) are also
  in British Columbia's coverage. Each region keeps its own list; the app reads both and dedupes by
  `_osmId` (the existing scenario "A border cell in two regions"). Alaska, Washington, Montana,
  Alberta and Yukon are not regions.
- **Publishing:** one manual run on `main` once the change merges (ADR 0027). Idaho, the region
  merged before it, is published (run 43364250202), so the run adds only British Columbia.
- **ADRs:** 0032 (bounds) and 0033 (fifth in the list).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `osm-extract`, "The regions list": a scenario for the list `colorado`, `wyoming`, `utah`, `idaho`,
  `british-columbia`. The rule is unchanged.

## Impact

- `regions.json`, `test/regions.test.mjs`, `test/assemble-site.test.mjs` and
  `test/coverage.test.mjs`. No code change: nothing in `src/` assumes a US state's path, shape,
  size or longitude range (design decision 5), the workflow builds one job per listed region, and the
  deploy job merges any number of artifacts.
- The workflow file and its weekly schedule (Mondays 05:23 UTC, ADR 0010) are not touched; the
  12 GiB heap is already on `main` (ADR 0030).
- The live site changes only on the manual run after merge (ADR 0027), which adds
  `british-columbia` to the manifest, or, if its job fails (bounds, memory, a file over 20 MiB),
  fails that job alone and still publishes the other four.
- garmin-map already searches every region a view overlaps and reads `coverage`, so it needs no
  change.
