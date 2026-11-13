# Proposal: alberta-region

## Why

The owner queued Alberta on 2026-11-13 as the sixth region, after British Columbia (ADR 0006: one
region at a time). It is about 662,000 km², and its Geofabrik extract is 335 MB, a quarter of
British Columbia's 1.2 GB. Calgary and Edmonton make it the most populous region so far.
Coverage by cells (ADRs 0020–0023) says where it has data, from its own Geofabrik polygon.

## What Changes

- **`regions.json`** gets a sixth entry, `alberta` (`Alberta`, Geofabrik
  `north-america/canada/alberta`, not clipped), after `british-columbia`.
- **Alberta's `bounds`:** 49.60 / -114.60 / 59.99 / -110.01 (south, west, north, east).
  - The block runs from just north of the Crowsnest Pass to the 60th parallel, and from east of
    the Continental Divide to the 4th meridian (110° W).
  - It holds all of Calgary, Edmonton, Red Deer, Lethbridge, Medicine Hat and Fort McMurray.
  - The change's author chose them (design decision 2, ADR 0035) and checked them against the
    real `alberta.poly` with the repository's own guard.
  - They matter only for the guard and for an app that reads nothing but `bounds`.
- **Coverage:** there is nothing new to build. The job computes `coverage` from `alberta.poly`:
  1,605 cells, counted from the real polygon. So Waterton, the Crowsnest Pass, Banff, Jasper and
  Grande Prairie are covered, though they lie outside `bounds`.
- **Borders:**
  - 106 of Alberta's cells are also in British Columbia's coverage, about 4,600 km², along the
    Divide and the 120th meridian.
  - Each region keeps its own list; the app reads both and dedupes by `_osmId` (the existing
    scenario "A border cell in two regions").
  - No cell is shared with Idaho. Montana, Saskatchewan and the Northwest Territories are not
    regions.
- **Publishing:** one manual run on `main` once the change merges (ADR 0027).
- **ADRs:** 0035 (bounds) and 0036 (sixth in the list).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `osm-extract`, "The regions list": a scenario for the list `colorado`, `wyoming`, `utah`, `idaho`,
  `british-columbia`, `alberta`. The rule is unchanged.

## Impact

- **Files changed:** `regions.json`, `test/regions.test.mjs`, `test/assemble-site.test.mjs`, ADRs
  0035 and 0036, and the ADR index `docs/decisions/README.md`.
  - There is no code change. Nothing in `src/` assumes a US state's path or shape; British
    Columbia showed that (its design decision 5).
  - The workflow builds one job per listed region, and the deploy job merges any number of
    artifacts.
- **Not touched:** the workflow file and its weekly schedule (ADR 0010), the 12 GiB heap
  (ADR 0030) and the category rules (ADR 0034).
- **The live site** changes only on the manual run after merge (ADR 0027), which adds `alberta` to
  the manifest. If Alberta's job fails (bounds, memory, a file over 20 MiB), that job fails alone,
  and the other five still publish.
- **garmin-map** already searches every region a view overlaps and reads `coverage`, so it needs
  no change.
