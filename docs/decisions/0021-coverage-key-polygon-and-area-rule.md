---
status: accepted
date: 2026-11-13
decision-makers: the owner (change coverage-by-cells, design open questions 1–4 and 6, answered 2026-11-13)
---
# Coverage is a `coverage` list of cell ids, from Geofabrik's polygon, by shared area

## Context and Problem Statement

ADR 0020 decides that each region lists the cells its state polygon touches. Left open were: how the
list is expressed in the manifest, which polygon is used, what "touches" means at an edge or a
corner, what happens to cells with files past the polygon, and what happens to a failed region's
entry kept from before the change. The app (garmin-map) reads the result, and it ignores keys it
doesn't know.

## Considered Options

Shape:
- (a) `coverage`: every covered cell id, empty or not, in the `cells` id form and order
- (b) `empty`: only the covered cells without a file; coverage is `cells` ∪ `empty`
- (c) runs of columns per row
- (d) the polygon itself in the manifest
- (e) `cells` changed to include empty cells (breaks today's app, which fetches every listed cell)

Polygon:
- Geofabrik's `<path>.poly`: already downloaded, and the outline the PBF is cut to
- US Census TIGER state lines: a new download, and lines that don't match the data's cut
- The state's OSM boundary relation: needs relation assembly

Touch rule:
- Shares area: more than 1e-12 square degrees, a margin for rounding only
- Any shared point, edge and corner contacts included

A kept entry from before `coverage`:
- Publish it without `coverage`
- Fill it from its `bounds`' cells
- Leave it out of the manifest

## Decision Outcome

The owner accepted, on 2026-11-13:

- **Shape (a)**:
  - The app needs one set lookup, in the same form as `cells`, and today's app keeps working.
  - (b) makes coverage a derived fact.
  - (c) is the fallback if the manifest grows too big; at about 10 KB per state-sized region it
    doesn't need it yet.
  - (d) moves geometry into the app.
- **Geofabrik's polygon**, its coordinates as read: a covered cell is one where the source can hold
  data.
- **Shares area**: wherever a polygon edge lies on a cell line, the closed rule would add a row of
  cells where the region has no area, hiding the no-data message there.
- **Cells with files past the polygon** stay in `cells`, not in `coverage`.
- **A failed region kept from before `coverage`** is published without it, and the app falls back to
  `bounds` for that entry.

The clipped-region rule and a size limit are ADR 0022.

### Consequences

- Good, because the app's rule is one line: a region has data for a cell exactly when its
  `coverage` lists it.
- Bad, because the manifest roughly doubles, from about 20 KB to about 40 KB for two regions.
- Bad, because border cells covered by two regions are read from both and merged by `_osmId`.
