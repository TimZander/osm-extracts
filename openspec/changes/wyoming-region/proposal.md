# Proposal: wyoming-region

## Why

The owner asked on 2026-11-13 to start adding Wyoming and Utah to the extract. Wyoming comes first,
as its own change (ADR 0006: one region at a time; ADR 0012: the order is the owner's call). Wyoming
is close to a rectangle, so it doesn't wait on ADR 0013. Utah follows in a later change.

## What Changes

- **`regions.json`** gets a second entry, `wyoming` (`Wyoming`, Geofabrik `north-america/us/wyoming`,
  not clipped), after `colorado`.
- **Wyoming `bounds`, proposed:** 41.01 / -111.04 / 44.99 / -104.06 (south, west, north, east), each
  edge just inside the state lines, as ADR 0016 did for Colorado. This leaves a strip about 0.02°
  (about 2.2 km) wide on the Colorado line in neither region's bounds. The bounds are open question 1
  in the design, and become an ADR only once the owner answers.
- **Spec:** "The regions list" gets a scenario for the two-region list.
- **ADRs:** 0018 (Wyoming's bounds, the owner accepting the assumption) and 0019 (merge only after garmin-map's multi-region search).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `osm-extract`: modified, "The regions list": a scenario for a list of `colorado` then `wyoming`.
  The rule itself is unchanged.

## Impact

- `regions.json` and `test/regions.test.mjs`. No code changes: the workflow already builds one job
  per listed region, and the deploy job already merges several regions' artifacts.
- The workflow file is not touched.
- The live site is unaffected until the next run after merge: the owner's, or the weekly schedule's
  (Mondays 05:23 UTC, ADR 0010), whichever comes first. That run adds `wyoming` to the manifest, or,
  if its bounds fail the guard, fails the Wyoming job naming the point, and still publishes Colorado.
- garmin-map must search every region a view overlaps (its own change) before or with the first run
  that publishes Wyoming. Until it does, a view across the state line may read only one region.
  Nothing here enforces the order; the merge timing does (design open question 3).
