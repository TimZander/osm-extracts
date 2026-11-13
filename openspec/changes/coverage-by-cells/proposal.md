# Proposal: coverage-by-cells

## Why

A region's coverage is one rectangle, `bounds`, that must lie inside the state, so a state that isn't
a rectangle can't be covered (ADR 0013), and two neighbours leave a strip between their bounds (the
Colorado–Wyoming gap at 41° N, ADRs 0016 and 0018). On 2026-11-13 the owner decided that coverage is
described by 0.25° cells instead: the manifest lists, for every region, each cell its state polygon
touches, empty ones included, and the app decides where data exists from those cells. That was chosen
over making region bounds overlap, which would leave Idaho's box about 40–45% outside Idaho, make the
result depend on region order, give silent empty results instead of a no-data message, name regions
on views where they have no data, and not carry over to CA, NV, OR, WA and MT.

## What Changes

- **Manifest:** each region entry gains `coverage`, the ids of every 0.25° cell whose area its
  Geofabrik polygon shares, sorted like `cells`, whether or not the cell has a file. `bounds`,
  `cells` and `split` are unchanged, so an app that reads only those keeps working (readers ignore
  extra keys).
- **The polygon** is the Geofabrik `<path>.poly` each region job already downloads for the bounds
  guard; a clipped region's coverage is its `bounds` instead. A cell the polygon meets only along an
  edge or at a corner is not covered.
- **Deploy job:** a region artifact's entry must carry a well-formed `coverage`. An entry kept from a
  run before this change (a failed region) keeps its form, without `coverage`, until the region next
  builds.
- **Region job report:** also gives the coverage cell count.
- **Files:** no new files are written; an empty covered cell has no file, as today.
- **ADRs:** 0020 (coverage by cells, the owner's decision; supersedes 0013) and 0021 (how coverage is
  expressed and computed, design open questions 1–6).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `osm-extract`:
  - added "Each region lists the cells it covers" and "A clipped region covers its bounds' cells";
  - modified:
    - "Features are filed into 0.25° cells": its empty-cell scenario names `cells` and `split`, since
      `coverage` lists empty cells;
    - "The manifest describes every region": `coverage` in the entry;
    - "The output is byte-stable": `coverage` sorted, also when an artifact lists it out of order;
    - "The deploy job accepts only well-formed region trees": an artifact without `coverage` fails;
    - "A failed region keeps its previous files": a kept entry keeps its `coverage`, or its lack of one;
    - "The previous site is read from the data branch": a kept `coverage` must be cell ids;
    - "Each region job reports its size": the coverage count.

## Impact

- Code: `src/poly.mjs` (cells a polygon covers), `src/build-region.mjs` (entry and report),
  `src/assemble-site.mjs` (entry checks and kept entries), and their tests. The workflow file is not
  touched.
- Manifest size: about 10 KB more per state-sized region before compression (design, decision 5).
- The live site is unaffected until the next run after merge: the owner's, or the weekly schedule's
  (Mondays 05:23 UTC, ADR 0010). That run adds `coverage` to each region that builds.
- garmin-map reads `coverage` in its own change; until it does, nothing it reads changes. It must
  fall back to `bounds` for an entry without `coverage`.
