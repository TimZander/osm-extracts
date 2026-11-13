# Proposal: utah-region

## Why

The owner said "Start Utah" on 2026-11-13. Utah is the third region, after Colorado and Wyoming (ADR
0006: one region at a time; ADR 0012: the order is the owner's call). Its border isn't a rectangle:
the Wyoming notch cuts its north-east corner, so `bounds` alone could cover only part of it (ADR
0013). Coverage by cells (ADRs 0020–0023) was done first for exactly this reason: every unclipped
region's `coverage` comes from its own Geofabrik polygon, notch included.

## What Changes

- **`regions.json`** gets a third entry, `utah` (`Utah`, Geofabrik `north-america/us/utah`, not
  clipped), after `wyoming`.
- **Utah `bounds`, proposed:** 37.01 / -114.03 / 40.99 / -109.06 (south, west, north, east): the part
  of the state below the Wyoming notch, each edge just inside its line, as ADRs 0016 and 0018 did.
  They are open question 1 in the design, and become an ADR once the owner answers.
- **Coverage:** nothing new to build. Utah's job computes `coverage` from `utah.poly` like any
  unclipped region, so the area north of 41° N west of the notch is covered though it lies outside
  `bounds`.
- **Borders:** a cell on the Colorado line (-109.05) or the Wyoming lines (41° N, -111.05) may be in
  two regions' `coverage`. Each region keeps its own list; the app reads both and dedupes by `_osmId`.
  A scenario pins this.
- **ADRs:** Utah's bounds, its order in the list, and the merge timing against the weekly run (design
  open questions 1–3).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `osm-extract`:
  - "The regions list": a scenario for the list `colorado`, `wyoming`, `utah`. The rule is unchanged.
  - "The manifest describes every region": a scenario for a border cell in two regions' `coverage`.
    The rule is unchanged.

## Impact

- `regions.json`, `test/regions.test.mjs`, `test/assemble-site.test.mjs`, `test/coverage.test.mjs`. No code change: the
  workflow builds one job per listed region, the deploy job merges any number of artifacts, and
  nothing compares one region's coverage with another's.
- The workflow file and its weekly schedule (Mondays 05:23 UTC, ADR 0010) are not touched.
- The live site is unaffected until the next run after merge, the owner's or Monday's. That run adds
  `utah` to the manifest, or, if its bounds fail the guard, fails Utah's job naming the point and still
  publishes the others.
- garmin-map already searches every region a view overlaps and reads `coverage`, so it needs no
  change.
