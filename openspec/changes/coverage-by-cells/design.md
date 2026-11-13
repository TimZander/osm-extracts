# Design: coverage-by-cells

## Context

See proposal.md, Why. Today a region job downloads `<path>.poly` from Geofabrik and uses it only for
the bounds guard (`src/poly.mjs`). The manifest entry is `id`, `name`, `bounds`, `dataDate`, `cells`
(cells with files) and `split`; garmin-map ignores extra keys. `download.geofabrik.de` resets every
connection from the agent container (`ws_closed_mid_exchange`, 2026-11-13), so no real polygon was
read for this design: the numbers below are estimates from the states' lines, and tests use the
fixtures.

## Goals / Non-Goals

**Goals:** every region entry says which cells it covers, so the app can tell "no data here" from
"no features here" cell by cell, and neighbouring regions leave no gap.

**Non-Goals:** removing or changing `bounds` or its guard (today's app still reads it); adding Utah or
any other region (their own changes); changing the cell grid or the files written.

## Decisions

1. **A new key, `coverage`, listing every covered cell id** (open question 1). Options:
   - (a) `coverage`: the full list of covered cell ids, empty or not, sorted like `cells`.
   - (b) `empty`: only the covered cells without a file; coverage is `cells` ∪ `empty`.
   - (c) runs per row, e.g. `"coverage": {"148": [[-437, -409]]}`: compact, but a second encoding.
   - (d) the polygon itself in the manifest, for the app to test against.
   - (e) change the meaning of `cells` to include empty cells: breaks today's app, which fetches every
     listed cell's file.

   (a) is chosen: it is the same id form and order as `cells`, needs no union or expansion in the
   app (a set of strings answers "is this cell covered?"), and keeps today's app working. (b) saves
   bytes but makes coverage a derived fact that two lists must keep right, and it isn't a superset
   rule the app can check. (c) is the fallback if the manifest grows too big (decision 5). (d) moves
   geometry into the app and loses the cell answer. (e) is a breaking change.
2. **The polygon is Geofabrik's `<path>.poly`** (open question 2), its coordinates as read (not
   rounded to six decimals like features), already downloaded and parsed for the bounds guard, and the very outline the PBF was cut to: a cell it covers is a cell where the
   source can hold data, and a cell it doesn't is one where it can't. Alternatives: US Census TIGER
   state lines (a new host and download, and lines that don't match the data's own cut); the
   state's OSM boundary relation (needs relation assembly the pipeline doesn't do). Geofabrik's
   outline has a small margin past the state line, so border cells are often covered by both
   neighbours; the app reads both (decision 4).
3. **"Touches" means "shares area"** (open question 3). A cell is the square from `row/4` to
   `(row+1)/4` and `col/4` to `(col+1)/4`. It is covered when the area of (polygon inside, holes cut
   out) ∩ square is more than 1e-12 square degrees (about 0.01 m²; it only absorbs rounding). So a
   polygon meeting a cell only along its edge or at a corner doesn't cover it. Why not the closed
   rule (any shared point counts)? Wherever a polygon edge lies on a cell line, it would add a whole
   row or column of cells in which the region has no area, and the app would show "no features"
   instead of "no data" along it while the neighbour isn't published. Geofabrik's margin (decision 2)
   makes that rare for a state line such as 41° N, but straight edges on multiples of 0.25 occur in
   clipped rectangles and in the fixtures, and the rule must give one answer for them.
   Computed per cell in the polygon's bounding box: each ring is clipped to the square
   (Sutherland–Hodgman, exact for a convex window), its area taken by the shoelace formula from the
   ring's first point, outer rings added and holes taken away. With the grid and the lines both on
   multiples of 0.25, an edge on a cell line clips to zero area exactly.
4. **Coverage is the polygon's, not the features'** (open question 4). A way the PBF keeps whole can
   put vertices, and so files, in cells past the polygon; those stay in `cells` (the existing rule
   that every written file is listed is unchanged) but are not added to `coverage`. A cell in
   `cells` and not in `coverage` holds a fragment of the neighbour's data; it does not make the cell
   covered.

   **Edge rules for the app** (what is sent to garmin-map):
   - a region has data for a cell exactly when the cell's id is in its `coverage`;
   - the data is the cell's file(s) when it is in `cells` (quarters when in `split`), and empty when
     not;
   - a cell in no region's `coverage` is "no data";
   - a cell in two regions' `coverage` is read from both and merged by `_osmId` (a feature on a
     border is in both);
   - an entry without `coverage` (kept from a run before this change) falls back to `bounds`.
5. **Manifest size.** The manifest is written with two-space indentation, about 19 bytes per id.
   Colorado's polygon spans about 18 rows × 29 columns: about 500 covered cells, about 10 KB more,
   roughly doubling its entry; Wyoming the same. Two regions: from about 20 KB to about 40 KB, a few
   KB compressed (Pages compresses JSON). A future 48-state extract (about 14,000 cells) would add
   about 270 KB uncompressed; if that is too much for the five-minute manifest cache on a phone,
   decision 1's option (c) is the change to make then.
6. **A clipped region's coverage is its `bounds`' cells** by the same area rule (open question 5):
   its data is cut to the rectangle, and the guard already keeps the rectangle inside the polygon, so
   the polygon's cells would claim data the region can't hold. No region is clipped today.
7. **Kept entries keep their form.** A failed region's previous entry is carried as it was. On the
   first run after merge, a region whose job fails is published without `coverage`; the next
   successful build adds it (open question 6). The deploy job requires `coverage` only of this run's
   artifacts. A kept
   `coverage`, when present, must be an array of distinct cell ids, or the deploy job fails ("The previous
   site is read from the data branch", modified here, since that is the only check on the previous
   manifest); it is then written sorted, like `cells`. An artifact's
   `coverage` out of order is sorted too, as `cells` is today; a duplicate or bad id fails it.
8. **The region job reports its coverage cell count**, beside the cell count, so a run's summary shows
   how many covered cells have no file.

## Risks / Trade-offs

- **[Risk] A malformed or degenerate polygon** (a self-touching ring) → the area sum can be off along
  the defect. Mitigation: the polygon is Geofabrik's, already parsed and guarded every run; the
  coverage count is in the job summary to compare with the cell count.
- **[Trade-off] A covered border cell next to an unpublished region** (Colorado–Utah today) is
  "covered" though only part of it has data, so the app shows no message for its Utah part. This is
  the owner's "touches" rule; the cell-wide no-data message returns once the neighbour publishes.
- **[Trade-off] A clipped region's edge cells** are covered whole though its data stops at its
  `bounds`, so the strip between the bounds and the cell lines shows "no features", not "no data".
  The same holds for the outer part of every border cell of an unclipped region (above).
- **[Risk] The polygon can't be read here** → the scenarios use fixtures; the first real run shows
  the coverage counts, which go into `docs/measurements.md`.

## Migration Plan

Merge; the next run (the owner's or Monday's) adds `coverage` to each region that builds. garmin-map
starts reading it in its own change, falling back to `bounds` where it is missing. Rollback: revert;
an app reading `coverage` falls back to `bounds`.

## Open Questions

1. **The shape** *Owner, 2026-11-13: accepted (ADR 0021).* (decision 1). *Assumption:* (a), a `coverage` list of every covered cell id.
2. **The polygon** *Owner, 2026-11-13: accepted (ADR 0021).* (decision 2). *Assumption:* Geofabrik's `<path>.poly`.
3. **The touch rule** *Owner, 2026-11-13: accepted (ADR 0021).* (decision 3). *Assumption:* shares area; an edge or corner contact alone
   doesn't cover a cell.
4. **Cells with files outside coverage** *Owner, 2026-11-13: accepted (ADR 0021).* (decision 4). *Assumption:* they stay in `cells`, not in
   `coverage`.
5. **A clipped region** *Owner, 2026-11-13: left open on purpose by the owner; the change builds on the assumption (ADR 0022, proposed).* (decision 6). The owner's rule names the state polygon; a clipped region's
   data is cut to its `bounds`. *Assumption:* its coverage is its `bounds`' cells, not its polygon's.
6. **A kept entry from before `coverage`** *Owner, 2026-11-13: accepted, option (a) (ADR 0021).* (decision 7). Options: (a) publish it without `coverage`
   until the region next builds, and garmin-map falls back to `bounds` for it; (b) fill it from its
   `bounds`' cells in the deploy job; (c) leave such a region out of the manifest. *Assumption:* (a),
   which publishes nothing the region's job didn't compute and drops no data; it only matters on the
   first run after merge, for a region whose job fails.
7. **A limit on `coverage`** *Owner, 2026-11-13: accepted, option (a) (ADR 0023).* (conformance review R1). The deploy job checks `coverage`'s form only:
   no limit on its length, and no check that it lies near the region's `bounds`; `manifest.json` has
   no size guard. Options: (a) none now; (b) at most a fixed count per region (e.g. 20,000 cells);
   (c) every covered cell within a margin of `bounds`. *Assumption:* (a). The ids come from this
   repository's own region job; the coverage count is in each job's summary; at the size of decision
   5 the manifest stays far from any limit. A limit is a new requirement, for its own change.

ADR 0020 records the owner's decision of 2026-11-13 itself and supersedes ADR 0013. ADR 0021
records the answers to questions 1–4 and 6 (accepted); ADR 0022 the assumption of 5
(proposed); ADR 0023 the answer to 7 (accepted).

## Spec review

Three rounds, each with one blocker, all fixed through the spec. Round 3's fixes (the kept-entry
exception in "Each region lists the cells it covers", the `coverage` form the deploy job checks,
`cells` as the list of files, open question 6) were not reviewed again: the workflow allows three
rounds unless the owner asks for more.
