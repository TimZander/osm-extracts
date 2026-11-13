# Design: alberta-region

## Context

See proposal.md. `curl` to `download.geofabrik.de` from the agent container is still reset
(`Recv failure: Connection reset by peer`, 2026-11-13). As for British Columbia, the agent's
web-fetch tool read Geofabrik's Alberta page, the directory index and the whole `alberta.poly`. The
poly came in four overlapping parts, joined where their lines overlapped exactly.

The polygon was then run through `parsePoly`, `polyFailure` and `coveredCells` from `src/poly.mjs`.
It is not committed: the tests use hand-written fixture polygons. The same tool re-read
`british-columbia.poly`, whose coverage came out at 3,467 cells, the count British Columbia
published on run 8. Taginfo, the OSM wiki and Overpass are unreachable, so there are no tag counts.

What was read:

- **The extract:** `north-america/canada/alberta`, with the same layout as the other regions:
  - `alberta-latest.osm.pbf` and its `.md5` (which holds an MD5 and the file name, as the others
    do), and `alberta.poly`;
  - PBF 335 MB, data to 2026-11-12;
  - for scale: British Columbia's is 1.2 GB, Colorado's 370 MB.
- **The polygon:** one ring of 453 points, 14,546 bytes.
  - **south:** one straight edge from (48.99251, -110.0051) to (48.99482, -114.0695), so a strip of
    Montana under 1 km wide is inside;
  - **east:** -110.0018 to -110.0051, about 0.005° west of the 4th meridian (110° W, the
    Saskatchewan line);
  - **north:** 60.00156–60.00254, a few hundred metres past the 60th parallel;
  - **west:**
    - about 400 points along the Continental Divide, from the Montana corner at -114.07 to
      (53.80, -120.00);
    - then the 120th meridian, at -120.0035 to -120.0043, north to 60° N.
- **Coverage from it:**
  - 1,605 cells, rows 195–240, columns -481 to -441, and none in column -440 (east of 110° W);
  - row 195 (south of 49° N) has 17 cells and row 240 (north of 60° N) has 41;
  - about 16 KB of manifest before compression.

## Decisions

1. **Alberta is one plain list entry, not clipped.** Its edges are its own extract's edges, as
   ADR 0018 says for Wyoming and ADR 0032's change did for British Columbia.
2. **The bounds are 49.60 / -114.60 / 59.99 / -110.01** (ADR 0035, the change author's choice).
   No rectangle spans the province, because the Divide runs diagonally from (49.0, -114.07) to
   (53.8, -120.0). Every candidate was checked with `polyFailure` against the real polygon; the
   east edge is -110.01 and the north edge 59.99 throughout.
   - (a) **49.01 / -114.05**, the block from the 49th parallel: 44.4 square degrees. Its west edge
     must stay east of the Divide's vertices near the Montana corner (-114.0573 at 49.024), so it
     cuts Calgary (downtown at -114.07, the city to about -114.32).
   - (b) **49.60 / -114.60**: 48.0 square degrees.
     - The binding Divide vertex is (49.7206, -114.6401), 0.04° west of the west edge. South of
       the box, the nearest vertex is (49.5615, -114.5881), 0.04° south of its south edge.
     - It holds all of Calgary, Edmonton, Red Deer, Lethbridge (49.69), Medicine Hat and Fort
       McMurray: most of the province's people.
   - (c) **51.00 / -115.67**: 50.9 square degrees. It adds Banff and Canmore but cuts Calgary south
     of 51.0, and loses Lethbridge and Medicine Hat.
   - (d) **The largest that passes, 53.39 / -119.73**: 64.2 square degrees. It holds Edmonton,
     Grande Prairie and Fort McMurray, but no Calgary.

   (b) is chosen.
   - Its south and west edges keep 0.04° from the Divide's vertices, which can move between
     extracts.
   - Its north and east edges are 0.01° inside the 60th parallel and the 4th meridian, as ADRs
     0016, 0018, 0024 and 0032 did. The polygon's east line is 0.005–0.008° east of -110.01.
   - Since every region has `coverage`, `bounds` matter only for the guard and for an app that
     reads nothing else. For such an app, the box holding the most people is the useful one.
   - Waterton, the Crowsnest Pass, Kananaskis, Banff, Jasper and Grande Prairie are outside
     `bounds` but in `coverage`.
3. **Alberta goes after British Columbia** in the list, so the manifest lists it sixth (ADR 0036).
   Appending keeps the order the regions were added in and moves no existing region, as ADRs
   0025, 0029 and 0033 did. Grouping by country is the same as appending today.
4. **No border logic.** As in the earlier regions, each region's `coverage` comes from its own
   polygon, and the deploy job compares no region with another.
   - **British Columbia: 106 shared cells, about 4,580 km² of overlap**, sampled every 0.005°.
     - 52 cells lie along the Divide, rows 195–213, among them Banff (`204_-463`), Lake Louise
       (`205_-465`) and Jasper (`211_-473`); Canmore (`204_-462`) is Alberta's only.
     - The other 54 lie along the 120th meridian, rows 214–240, columns -481 and -480. Both
       polygons cross -120.0, the line between those columns: British Columbia's at about
       -119.996, Alberta's at about -120.004.
     - British Columbia's line is the coarser one (83 points to Alberta's 453), so the trails in
       the overlap are in British Columbia's files today. Once Alberta publishes, they are in both,
       and the app dedupes them by `_osmId`.
     - British Columbia's lane counted the same 106 from its own copy of the polygon.
   - **Idaho:** no shared cell. Idaho's cells along 49° N are columns -469 to -465; Alberta's row
     195 starts at column -457.
   - **Montana, Saskatchewan and the Northwest Territories** are not published. Alberta alone
     covers its side of those border cells, the trade-off ADR 0020 accepts.
   - **49° N and the 120th meridian are both cell lines.** British Columbia's task 2.2 pinned a
     polygon crossing a cell line into the next row, so no new coverage test is needed.
5. **Nothing in the pipeline is new for a Canadian region.** British Columbia's design decision 5
   checked `src/` for US-only assumptions, and its run 8 confirmed it. `alberta` and
   `north-america/canada/alberta` match `REGION_ID` and the Geofabrik path pattern.
6. **Publishing by a manual run after merge** (ADR 0027): one run of the extract workflow on
   `main`, default inputs, once no other extract run is in progress. That run adds Alberta, which
   keeps ADR 0006's pace of one new region per deploy. The workflow is not touched.

## Estimates for the run with Alberta

To be measured on its first run, into `docs/measurements.md`. Low confidence: no tag counts could
be read.

- **Size:**
  - British Columbia produced 0.25 KB per km² (run 8), and the states 0.42–0.94.
  - Alberta's south is farmland whose grid roads (`unclassified`, most named "Township Road" or
    "Range Road") carry no forest-road mark (ADR 0034), so they are not selected.
  - Its oil-and-gas lease roads and cutlines are largely `highway=track`, which counts as
    `trails`. The new `forest_roads` category adds few ways here: its marks are names and refs
    such as FSR, Forest Service Road and Resource Road, and operators of British Columbia and the
    US. Alberta's lease roads are mostly unnamed.
  - A guess of **200–600 MB, about 330 MB**.
- **Memory:** about 5.2 bytes of RSS per output byte (ADR 0030), so 1–3 GB under the 12 GiB heap.
- **Cells and files:**
  - 1,500–1,605 cells with files, since the grid roads and tracks reach almost every land cell.
  - Splits at the 4 MiB threshold: perhaps 4–12, in Calgary (rows 203–205, columns -458 to
    -456), Edmonton (around `214_-454`), and perhaps Red Deer and Lethbridge, at 3 extra files
    each.
  - That makes about **1,520–1,640 files**, and the site about 5,600–5,700 with the 4,047 it holds
    now. The guard is 19,000; Cloudflare's free plan allows 20,000.
- **Largest file:** a Calgary or Edmonton quarter, likely 5–12 MiB. Vancouver's largest was 7.0 MiB
  and Denver's 14.2 MiB.
- **Time:**
  - the 335 MB download takes about 2 minutes (British Columbia's 1.2 GB took 6 min 9 s);
  - osmium and the build take about 1–2 minutes;
  - so about **4–6 minutes** for Alberta's job, under British Columbia's 7 minutes, which still
    sets the run's wall time.

## Risks / Trade-offs

- **[Risk] A file over 20 MiB**, most likely a Calgary quarter. There is no second split level
  (ADR 0017), so only Alberta's job fails, naming the file and its size; the other five still
  publish. The fix would be a new change to the split rule, with the measured size.
- **[Risk] The bounds fail the guard.** This is unlikely, since they were checked against the real
  polygon with 0.04° to spare, but Geofabrik can redraw it. Only Alberta's job fails, naming the
  first failing point.
- **[Risk] More `track` than the estimate** (lease roads, cutlines, seismic lines). It costs bytes
  and files but no correctness; the measurements record it.
- **[Trade-off] Duplicate data along the Divide and 120° W:** 106 cells hold the same trails in
  two regions' files. The app dedupes by `_osmId` (the existing scenario "A border cell in two
  regions").

## Open Questions

None for the owner. The bounds and the order are the change author's choices (ADRs 0035 and
0036), as the orchestrator's brief relaying the owner says. Publishing timing is ADR 0027, and the
heap is ADR 0030, both already decided.
