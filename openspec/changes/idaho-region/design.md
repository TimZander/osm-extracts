# Design: idaho-region

## Context

See proposal.md. `download.geofabrik.de` resets every connection from the agent container
(`Recv failure: Connection reset by peer`, 2026-11-13), so `idaho.poly` and the extract's `.md5`
couldn't be read here, as for the other three states. The workaround, as in utah-region: the lines
below are Idaho's lines as generally known, not read from the polygon; a rough outline from them
(about 30 vertices, kept out of the repository) was run through `coveredCells` and `polyFailure`
from `src/poly.mjs` for the estimates and to check the bounds; the tests use fixture polygons. The
first real run checks the bounds against `idaho.poly` and reports the real coverage count. The
extract is Geofabrik's `north-america/us/idaho` (`idaho-latest.osm.pbf`, `.md5`, `idaho.poly`), the
same layout as the other states.

Idaho's lines, approximately:

- south (Nevada, Utah): close to 42.00, from about -117.026 to -111.05;
- east (Wyoming): about -111.05, from 42.00 north to the Montana corner at about 44.48;
- north-east (Montana): west along the Centennial Mountains (about 44.4–44.7), then north-west along
  the Continental Divide and the Bitterroots (Lemhi Pass about 44.97 / -113.44, Lost Trail Pass
  about 45.69 / -113.94, Lolo Pass about 46.63 / -114.58) to -116.05 at about 47.98, then north;
- north (Canada): 49.00, from -117.04 to -116.05: the panhandle, about 1° wide;
- west (Oregon, Washington): the meridian about -117.026 from 42.00 to the Owyhee's mouth (about
  43.81), then the Snake River, which swings east to about -116.93 near Payette and west to about
  -117.22 at Farewell Bend, north through Hells Canyon to Lewiston (about 46.42 / -117.04), then the
  meridian about -117.04 north to 49.00.

Its bounding box is about 42.0–49.0 × -117.24 to -111.05, 700 cells; the outline covers about 436 of
them, so about 38 % of the box's cells are outside the state (by area, about 43 %: the state is
about 25 of the box's 43 square degrees; cells along the lines count as inside).

What the run of 2026-11-13 (43359776477, Colorado and Wyoming) measured: Wyoming's job built in
30 s (19 s of it the PBF download), 106,197,116 bytes, 521 cells, none split, largest cell
2,784,578 bytes, 519 coverage cells, a 25.6 MB artifact; Colorado's job took 3 min 21 s at "Build the
region" (1 min 28 s in run 2); deploy 31 s. Wyoming's 519 coverage cells against the 464 its lines
alone touch (16 rows × 29 columns) show that Geofabrik's polygon reaches past the state lines by
enough to cross a cell line.

Utah's own run (43361499180, 2026-11-13, after the utah-region archive) succeeded: Utah's job built
in 1 min 41 s, 200,332,870 bytes, 348,052 ways, 433 cells of which 8 split (largest cell `162_-448`,
Salt Lake City, 22,292,327 bytes before splitting), 457 files, 419 coverage cells, a 40.0 MB
artifact; the whole run took 3 min 14 s, deploy 32 s.

## Decisions

1. **Idaho is one plain list entry, not clipped**, for the reasons ADR 0018 gives for Wyoming: its
   lines are its own extract's edges.
2. **The bounds are the southern block: 42.01 / -117.02 / 43.75 / -111.06** (ADR 0028, the change
   author's choice). Any rectangle inside Idaho is small against the state. The candidates:
   - (a) the southern block, 42.01 / -117.02 / 43.75 / -111.06: 1.74° × 5.96° ≈ 10.4 square degrees,
     175 cells; holds Boise (43.62 N), Twin Falls, Pocatello and Idaho Falls. Its west edge is on the
     straight Oregon meridian, and its north edge stays about 0.06° south of the Owyhee's mouth,
     where the line turns onto the Snake;
   - (b) the same block taken north to about 44.4, under the Montana line, with the west edge east of
     the Snake (about -116.85): about 2.4° × 5.8° ≈ 13.8 square degrees, but it rests on the Snake's
     course near Payette and Weiser, the line least well known here;
   - (c) the largest rectangle read from `idaho.poly`, which needs a machine that can reach Geofabrik.

   (a) is chosen: every edge rests on a straight surveyed line or stays clear of the river, and since
   every region has `coverage`, `bounds` matter only for the guard and for an app that reads nothing
   else. The rough outline puts (a) inside the state (`polyFailure` finds no failure). The east edge
   is -111.06, as for Utah's notch side, 0.01° inside a line of about -111.05.
3. **Idaho goes after Utah** in the list, so the manifest lists it fourth (ADR 0029): appending keeps
   the order the regions were added in and moves no existing region, as ADR 0025 did for Utah.
4. **No border logic**, as in utah-region decision 4: each region's `coverage` comes from its own
   polygon, and the deploy job compares no region with another. Where cells are in two regions:
   - Wyoming line, -111.05: column -445 (-111.25 to -111.0) holds the line, so Idaho and Wyoming both
     cover it from row 168 (42.0–42.25) to row 177 (44.25–44.5), and row 178 where the Montana corner
     (44.48) and the margin reach it.
   - Utah line, 42° N, from -114.04 to -111.05: a cell line (row 167 below, 168 above). Wyoming's
     measured margin says Geofabrik's polygons cross such a line, so rows 167 and 168 are likely in
     both Utah's and Idaho's coverage along it, with files on both sides where trails cross. If the
     margin didn't cross, each side would hold its own row and no cell along the line would be in
     neither.
   - The corner of Idaho, Utah and Wyoming (42.0 / -111.05) is in cells `167_-445` and `168_-445`,
     which can be in all three regions.
   - Nevada, Oregon, Washington, Montana and Canada aren't published; their side of Idaho's border
     cells is covered by Idaho only, the trade-off ADR 0020 accepts.

   The existing scenario "A border cell in two regions" already pins that both regions keep a shared
   cell; tasks 2.1 and 2.2 test the two lines' geometry.
5. **The panhandle needs nothing of its own.** North of 46.5 N the outline covers about 71 cells,
   five or six columns wide at the top (-469 to -465). Coverage follows the polygon, so the cells
   east of the panhandle, in Montana, aren't listed though they are inside Idaho's bounding box. That
   is the case coverage by cells was built for; task 2.3 tests it.
6. **Publishing by a manual run after merge** (ADR 0027, the owner's decision of 2026-11-13,
   recorded by the Utah lane in PR #14, superseding ADR 0026's "Monday's run publishes Utah"): once the change merges, one manual run of
   the extract workflow on `main`, default inputs, when no other extract run is in progress and every
   region merged before Idaho has deployed. Utah's manual run (43361499180) started on 2026-11-13
   after its archive and published Utah; Idaho's run comes after it, so it adds only Idaho as a
   new region, which keeps ADR 0006's pace of one new region per deploy. If Utah's run failed, Idaho's
   run would publish both, so it waits and the orchestrator is told. Neither the workflow nor its
   schedule changes.

## Estimates for the run with Idaho

To be measured on Idaho's first run, into `docs/measurements.md`.

- **Coverage:** about 436 cells from the outline, about 470 with a Geofabrik margin like Wyoming's.
  About 9 KB more manifest before compression.
- **Size:** somewhere between Wyoming (106 MB, 105,233 ways) and Utah (200 MB, 348,052 ways), maybe
  above Utah: Idaho has more national forest. A guess of 120–260 MiB and 400–460 cells with files.
- **Dense cells:** Boise and its foothills (`174_-465`), Sun Valley (`174_-458`) and Coeur d'Alene
  (`190_-468`) are the likeliest to pass the 4 MiB split threshold. Wyoming's densest cell was
  2.8 MB and Colorado's Denver cell 30.5 MiB, whose largest quarter was 14.2 MiB; no Idaho cell is
  expected near Denver's or Salt Lake City's (22.3 MB), so no file near the 20 MiB guard. If one were, only Idaho's job fails.
- **Files:** about 450 Idaho files; the site about 2,000 with the other three, far under 19,000.
- **Time:** region jobs run in parallel (matrix, `fail-fast: false`). Idaho's PBF is somewhat
  larger than Wyoming's, so its job should take about 30–90 s, under Colorado's (1.5–3.5 min), which
  sets the run's wall time; a fourth job adds none. The deploy job grows with files and artifacts:
  31 s on 2026-11-13, perhaps 45–60 s with Utah and Idaho; the artifact download grows by Idaho's
  zip, about 25–40 MB. All far inside the jobs' limits (120 and 30 minutes). Billed minutes: the
  repository is public, so standard runners are free.

## Risks / Trade-offs

- **[Risk] The bounds fail the guard** (a line the design has wrong) → Idaho's job fails naming the
  first failing point; the other three still publish, and Idaho, never published, is left out of the
  manifest. The fix is new bounds from the named point, in a new change.
- **[Trade-off] Most of Idaho is outside `bounds`:** about 10.4 of Idaho's roughly 25 square degrees.
  It is all inside `coverage`, so only an app reading `bounds` alone misses it.
- **[Trade-off] Duplicate features on the borders:** a trail on a shared cell is in two or three
  files; the app reads each and dedupes by `_osmId` (ADR 0021).
- **[Risk] The polygon can't be read here** → the tests use fixtures; the first real run gives the
  coverage count in Idaho's job summary.

## Open Questions

None for the owner. The bounds and the order are the change author's choices (ADRs 0028, 0029), as
the orchestrator's brief says; the publishing timing is the owner's decision of 2026-11-13 (ADR 0027).

## Spec review

One round: no blocker. Fixed: Idaho's manual run waits for Utah's deploy (A1), and ADR 0027
supersedes ADR 0026 (B1; that ADR and the mark on 0026 come from PR #14, which records the same
owner decision for Utah, so this change doesn't record it twice); the proposal says the 40–45 % is by area and the
design gives both measures (A2); the proposal says the north edge is on no line (D1); the proposal's
Impact lists `test/build-region.test.mjs` (E1). E2 (tasks 2.x test a requirement with no delta) is
as intended: they are regression tests of the borders' geometry, decision 4.

## Conformance review

Verdict: conforms, no findings. Mutation spot checks (manifest by id order, list order swapped, edge
contact as cover, margin not counted) each failed a test.
