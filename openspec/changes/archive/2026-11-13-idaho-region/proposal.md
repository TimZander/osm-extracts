# Proposal: idaho-region

## Why

The owner said "start Idaho" on 2026-11-13. Idaho is the fourth region, after Colorado, Wyoming and
Utah (ADR 0006: one region at a time). Its outline is far from a rectangle: a wide south along the
Snake River Plain, the Montana line running north-west along the Bitterroots, and a panhandle about
1° wide up to Canada. About 40–45 % of its bounding box's area is outside the state, so `bounds` alone would
say little; coverage by cells (ADRs 0020–0023) says where it has data, from its own Geofabrik
polygon.

## What Changes

- **`regions.json`** gets a fourth entry, `idaho` (`Idaho`, Geofabrik `north-america/us/idaho`, not
  clipped), after `utah`.
- **Idaho `bounds`:** 42.01 / -117.02 / 43.75 / -111.06 (south, west, north, east), the southern
  block from the Oregon meridian to the Wyoming line: the south, west and east edges just inside
  their lines, the north edge a choice south of where the Oregon line turns onto the Snake. The change's
  author chose them (design decision 2, ADR 0028): they matter only for the guard and for an app
  that reads nothing but `bounds`.
- **Coverage:** nothing new to build. Idaho's job computes `coverage` from `idaho.poly`, so the
  panhandle and everything north of 43.75 is covered though outside `bounds`.
- **Borders:** cells on the Wyoming line (-111.05, column -445) and, where Geofabrik's margin crosses
  it, the Utah line (42° N, a cell line) are in two regions' `coverage`. Each region keeps its own
  list; the app reads both and dedupes by `_osmId` (the existing scenario "A border cell in two
  regions").
- **Publishing:** the owner decided on 2026-11-13 that a new region publishes by one manual run on
  `main` right after its change merges, once every region merged before it has deployed, so each
  run adds one new region (ADR 0027, from PR #14, superseding ADR 0026). Idaho doesn't wait for a Monday; its run
  follows Utah's (43361499180, started 2026-11-13).
- **ADRs:** 0028 (Idaho's bounds) and 0029 (fourth in the list). The publishing decision is ADR 0027,
  recorded in PR #14, which this change follows rather than recording again.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `osm-extract`, "The regions list": a scenario for the list `colorado`, `wyoming`, `utah`, `idaho`.
  The rule is unchanged.

## Impact

- `regions.json`, `test/regions.test.mjs`, `test/assemble-site.test.mjs`, `test/coverage.test.mjs`,
  and `test/build-region.test.mjs` (its unlisted-region example moves from `idaho` to `montana`).
  No code change: the workflow builds one job per listed region, the deploy job merges any number of
  artifacts, and nothing compares one region's coverage with another's.
- The workflow file and its weekly schedule (Mondays 05:23 UTC, ADR 0010) are not touched.
- The live site changes only on the manual run after merge (ADR 0027), which adds `idaho` to the
  manifest, or, if its bounds fail the guard, fails Idaho's job naming the point and still publishes
  the others.
- garmin-map already searches every region a view overlaps and reads `coverage`, so it needs no
  change.
