# Proposal: colorado-bounds-and-empty-push

## Why

The first live run (2026-11-07, run 42329501017, `docs/measurements.md`) did not build Colorado.
Its `bounds` (37 / -109.06 / 41 / -102.04, ADR 0009) reach outside Geofabrik's polygon. The guard
said so, but not where. With no region built and no previous region, the deploy then published a site
whose manifest lists no region, over the placeholder. That is what the spec says, but the owner has
now decided against it ("add the no-empty-push rule").

## What Changes

- **Bounds guard:** its error names the first failing point, so a failure says where.
- **Publishing:** the deploy pushes nothing when the new manifest lists no region (owner-decided).
- **Colorado `bounds`, proposed:** 37.01 / -109.04 / 40.99 / -102.06, each edge inside the state
  lines (design, decision 1 and open question 1). They become an ADR superseding 0009 only once the
  owner answers.
- **ADR:** 0015 (no empty push, owner-decided).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `osm-extract`:
  - added, "The bounds guard names the first failing point";
  - modified, "Publishing replaces the site with one orphan commit": no push when the manifest lists
    no region (checked first), and a site without a valid manifest fails.

## Impact

- `src/poly.mjs` and `src/build-region.mjs` (the error message).
- `src/publish.sh` (the no-region check).
- `regions.json`, and their tests.
- The live site is unaffected until the next run. That run then publishes Colorado, or, if the bounds
  still fail, pushes nothing and names the failing point.
