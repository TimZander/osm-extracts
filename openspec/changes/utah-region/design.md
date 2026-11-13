# Design: utah-region

## Context

See proposal.md. `download.geofabrik.de` resets every connection from the agent container (proxy:
`ws_closed_mid_exchange`, 2026-11-13), so `utah.poly` couldn't be read here, as for Colorado and
Wyoming. The numbers below come from Utah's lines as generally known, not from the polygon. The
extract is Geofabrik's `north-america/us/utah` (`utah-latest.osm.pbf`, `.md5`, `utah.poly`), the
same layout as the other two states.

Utah's lines, approximately:

- south (Arizona): close to 37.00;
- west (Nevada): about -114.040 at the Idaho corner to about -114.050 at the Arizona corner;
- north (Idaho): close to 42.00, from the west line to -111.05;
- the notch (Wyoming): east along about -111.046 to -111.05 from 42.00 down to 41.00, then along
  41.00 (about 40.997 to 41.00) to the Colorado corner;
- east (Colorado): about -109.045 (Four Corners) to -109.050 (the Wyoming corner), the line ADR 0016
  gives for Colorado's west.

The published site still holds Colorado alone, without `coverage` (data `9f569fb`). The first run
with Wyoming and `coverage` is the weekly run of Monday 2026-11-16, unless the owner starts one first.

## Decisions

1. **Utah is one plain list entry, not clipped**, for the reasons ADR 0018 gives for Wyoming: its
   lines are its own extract's edges.
2. **The bounds are the part below the notch, just inside the lines:** 37.01 / -114.03 / 40.99 /
   -109.06 (open question 1). A rectangle must lie inside the polygon, so with the notch it can be
   either the south block (below 41° N, the full width) or the west block (west of -111.05, the full
   height):
   - south block, 37.01 / -114.03 / 40.99 / -109.06: about 3.98° × 4.97° ≈ 19.8 square degrees, 16
     rows × 21 columns of cells (rows 148–163, columns -457 to -437);
   - west block, 37.01 / -114.03 / 41.99 / -111.06: about 4.98° × 2.97° ≈ 14.8 square degrees.

   The south block is a third larger, holds Salt Lake City (40.76 N), and avoids the two lines this
   design is least sure of, the Idaho line and the notch's west side. The west edge is -114.03, not
   -114.04, because the Nevada line reaches about -114.040 at its north end. Since every region now
   has `coverage`, `bounds` matter only for the guard and for an app that reads nothing else: the
   area north of 41° N is covered by cells either way.
3. **Utah goes after Wyoming** in the list, so the manifest lists it third (open question 2):
   appending keeps the order the regions were added in and changes no existing position.
4. **No border logic.** Each region's `coverage` is computed from its own polygon alone ("Each region
   lists the cells it covers"), and the deploy job compares no region with another, so a cell on a
   line can be in two regions' `coverage` and `cells`, each with its own file. The app reads both and
   dedupes by `_osmId`. Where that happens:
   - Colorado line, -109.05: column -437 (-109.25 to -109.0) holds the line, so both states share
     area in it from row 148 to row 163; Colorado also covers it today (ADR 0016's west line).
   - Wyoming's west line, -111.05: column -445 (-111.25 to -111.0), rows 164–167, in both.
   - 41° N, from -111.05 to -109.05, is a cell line (row 163 below, 164 above). Only Geofabrik's
     margin past the line puts a sliver of Utah in row 164 or of Wyoming in row 163; when it does,
     those cells are in both. Either way no cell along the line is in neither.
   - Idaho and the other neighbours aren't published; their side of Utah's border cells is covered
     by Utah only, the trade-off ADR 0020 accepts.

   The new scenario under "The manifest describes every region" pins that two regions both keep a
   shared cell, its files and its `coverage`.
5. **This is an sdd change, not a data-only edit**, as for Wyoming: it changes what a run publishes,
   and its bounds are an owner decision.

## Estimates for the weekly run

To be measured on the first run with Utah, into `docs/measurements.md`.

- **Coverage:** about 390 cells without Geofabrik's margin (16 rows × 21 columns below 41° N, plus
  4 rows × 13 columns west of the notch), up to about 430 with it (rows 147 and 168 and the notch's
  row 164). About 8 KB more manifest before compression.
- **Size:** Utah has fewer mapped trails than Colorado (≈ 242 MiB, 518 cells, 11 split). A guess of
  100–200 MiB and 350–420 cells with files.
- **Dense cells:** the Wasatch Front, `162_-448` and `163_-448` (Salt Lake City), `162_-447` and
  `163_-447` (the Cottonwood canyons), `162_-446` (Park City), `160_-447` (Provo), are likely over the 4 MiB split
  threshold and split into quarters. Denver's cell, 30.5 MiB, split into quarters of at most 14.2 MiB;
  a Salt Lake City cell is expected to be smaller, so no quarter is expected near the 20 MiB guard.
  If one were, only Utah's job fails, naming the file.
- **Files:** about 400 Utah files; the site about 1,400 with Wyoming's, far under 19,000.
- **Time:** region jobs run in parallel (matrix, `fail-fast: false`), each about 1.5 minutes for
  Colorado. A third job adds no wall time to the run beyond the deploy job, which grows with the
  files (22 s for 555 files) and should stay well under a minute; the artifact download grows by
  Utah's zip, about 30–40 MB. Billed minutes: the repository is public, so standard runners are free.

## Risks / Trade-offs

- **[Risk] The bounds fail the guard** (a line the design has wrong) → Utah's job fails naming the
  first failing point; Colorado and Wyoming still publish, and Utah, never published, is left out
  of the manifest. The fix is new bounds from the named point.
- **[Trade-off] Strips outside `bounds`:** about 0.01–0.02° along the south, west and east lines,
  and everything north of 40.99. They are inside `coverage`, so only an app reading `bounds` alone
  misses them.
- **[Trade-off] Duplicate features on the borders:** a trail on a shared cell is in two files; the
  app reads both and dedupes by `_osmId` (ADR 0021).
- **[Risk] The polygon can't be read here** → the scenarios use fixtures; the first real run gives
  the coverage count in Utah's job summary.

## Open Questions

1. **Utah's bounds.** Options: (a) the south block, 37.01 / -114.03 / 40.99 / -109.06; (b) the west
   block, 37.01 / -114.03 / 41.99 / -111.06; (c) read `utah.poly` from a machine that can reach
   Geofabrik and set the largest rectangle from it. *Assumption:* (a), decision 2. The answer becomes
   an ADR.
2. **The order.** Options: (a) after Wyoming, third; (b) alphabetical (`colorado`, `utah`,
   `wyoming`), which moves Wyoming. *Assumption:* (a); the app searches every region a view overlaps,
   so the order changes nothing it shows.
3. **When to merge, given the weekly run.** Monday 2026-11-16 05:23 UTC is the first run with
   Wyoming and `coverage`. Options: (a) merge before it, so that run publishes all three; (b) merge
   after it, so Wyoming and `coverage` are measured on their own first. *Assumption:* (a): the region
   jobs are independent, so a failing Utah job costs only Utah, and its summary shows its own
   numbers apart from the others'. The merge waits for the owner's "merge" either way.

## Spec review

One round: no blocker. Fixed: task 2.2 tied to "Each region lists the cells it covers" (E1); the
proposal says "unclipped" (F1), names all three ADR topics (D1) and lists `test/coverage.test.mjs`
(E2); Park City's cell is `162_-446` (A1).
