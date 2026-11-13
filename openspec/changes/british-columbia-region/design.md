# Design: british-columbia-region

## Context

See proposal.md. As for the four states, `curl` to `download.geofabrik.de` from the agent
container is reset (`Recv failure: Connection reset by peer`, 2026-11-13). The workaround this time:
the agent's web-fetch tool, which goes by another route, read Geofabrik's British Columbia page and
the whole `british-columbia.poly` (one ring, 83 points). The polygon was then run through
`parsePoly`, `polyFailure` and `coveredCells` from `src/poly.mjs`. It is not committed: the tests
use hand-written fixture polygons. Geofabrik's taginfo, the OSM wiki and Overpass were all
unreachable, so there are no tag counts.

What was read:

- **The extract:** `north-america/canada/british-columbia` (`british-columbia-latest.osm.pbf`,
  `.md5`, `british-columbia.poly`), the same layout as the states. PBF 1.2 GB, data to
  2026-11-12. For scale: Colorado's is 370 MB, Utah's 163 MB, Idaho's 124 MB, Wyoming's 91 MB.
- **The polygon** follows the province only roughly:
  - **south:** 48.9945–48.9949 from -114.07 to -121.74, so a strip of about 50 m of Montana,
    Idaho and Washington is inside. From -121.74 to -123.30 it runs at 49.0003–49.0007, the
    closest it comes to the bounds' south edge (49.01, about 1 km clear). It then turns south at
    -123.30 to 48.83, so Point Roberts (south of 49° N, east of that turn) is outside, and follows
    Haro Strait, which keeps the San Juan Islands out.
  - **sea:** a wide ocean margin, out to (46.41, -128.98) and (53.58, -141.78), that holds
    Vancouver Island and Haida Gwaii, then the Alaska panhandle line drawn coarsely (some
    panhandle land near Hyder and Stewart is inside).
  - **north:** 60.003–60.007, past the 60th parallel by a few hundred metres.
  - **east:** the 120th meridian (-119.996 to -119.999) from 60° N to 53.81° N, then about 50 points
    south-east along the Continental Divide to the Montana corner at -114.07.
- **Coverage from it:** 3,467 cells, rows 185–240, columns -568 to -457. That is more than the
  roughly 2,100 land cells because of the ocean margin. About 35 KB of manifest before
  compression; ADR 0023 sets no limit.

The 2,500-cell figure in the brief was a land-only upper bound. Land is about 945,000 km², and a
0.25° cell is about 506 km² at 49° N and 397 km² at 59° N, so about 2,050 land cells.

## Decisions

1. **British Columbia is one plain list entry, not clipped.** Its edges are its own extract's
   edges, as ADR 0018 says for Wyoming. Clipping would cut the coast and the Kootenays out of the
   data.
2. **The bounds are 49.01 / -130.00 / 59.99 / -120.01** (ADR 0032, the change author's choice).
   Every candidate was checked with `polyFailure` against the real polygon:
   - (a) **49.01 / -130.00 / 59.99 / -120.01**: 10.98° × 9.99° ≈ 109.7 square degrees, inside.
     Its south, north and east edges are 0.01° inside the 49th parallel, the 60th and the 120th
     meridian, as ADRs 0016, 0018 and 0024 did. Its west edge is 0.14° east of the binding
     polygon vertex (55.27, -130.1435), at the head of Portland Inlet. It holds Vancouver (49.28 N),
     Kamloops, Kelowna, Prince George and Fort St. John.
   - (b) **The widest that passes**, 49.01 / -130.14 / 59.99 / -120.01 (the vertex is at -130.1435):
     0.14° more to the west, but only 0.0035° from Geofabrik's vertex, which can move between
     extracts. At -130.15 the guard fails.
   - (c) **A rectangle reaching east past -120 south of 53.8° N** (the Kootenays): any such box
     must stop under the Divide at its narrowest. For example, 49.01 / -121.73 / 53.79 / -114.6
     fails at its north-east corner.

   (a) is chosen. Since every region has `coverage`, `bounds` matter only for the guard and for an
   app that reads nothing else. Victoria (48.43 N), the Kootenays, Haida Gwaii and the north-west
   are outside `bounds` but in `coverage`.
3. **British Columbia goes after Idaho** in the list, so the manifest lists it fifth (ADR 0033).
   Appending keeps the order the regions were added in and moves no existing region, as ADRs 0025
   and 0029 did.
4. **No border logic.** As in utah-region and idaho-region, each region's `coverage` comes from its
   own polygon. The deploy job compares no region with another.
   - **Idaho, 49° N:** Idaho's published coverage includes rows 195 and 196 at columns -469 to
     -465 (10 cells), because its polygon passes 49° N. British Columbia's polygon dips to 48.9945,
     so it covers row 195 too. All 10 of those cells are in both regions' coverage (counted from the
     real polygon). 49° N is a cell line, the case idaho-region's task 2.2 tested for 42° N.
   - **Alberta:** its polygon was read the same way. Between 49° N and 60° N, no point sampled at
     0.005° lies in neither polygon. About 4,700 km² east of the Divide (fringes of Banff and
     Jasper) is in both, because British Columbia's line is the coarser one. Alberta is not a
     region yet, so for now those trails are in British Columbia's files. Of the cells Alberta's
     polygon would cover, 106 are also in British Columbia's coverage.
   - **Alaska, Washington, Montana and Yukon** are not published. Their side of a border cell is
     covered by British Columbia only, the trade-off ADR 0020 accepts.
5. **Nothing in the pipeline is US-only.** Checked in `src/`:
   - `REGION_ID` and the Geofabrik path pattern accept `british-columbia` and
     `north-america/canada/british-columbia`, and the bounds range check is global (±90, ±180).
   - Cell ids use `floor(lon × 4)`, so -139.23 is column -557 and -141.78 is column -568, written as
     `214_-568` with no special case.
   - The 20 MiB guard measures UTF-8 bytes (`Buffer.byteLength`), so names with diacritics, common
     in Indigenous place names, are counted right.
   - Attribution is the same ODbL wording: OSM's licence doesn't change with the country.

   Task 2.1 pins the far-west cell ids, and task 2.2 pins the 49° N cells, both on fixture polygons.
6. **Publishing by a manual run after merge** (ADR 0027): one run of the extract workflow on
   `main`, default inputs, once no other extract run is in progress. Idaho, merged before British
   Columbia, published on run 43364250202, so this run adds only British Columbia, which keeps ADR
   0006's pace of one new region per deploy. The workflow is not touched.

## Estimates for the run with British Columbia

To be measured on its first run, into `docs/measurements.md`. Low confidence: no tag counts could
be read.

- **Size:** the states produced 0.42 (Wyoming) to 0.94 (Colorado) KB of output per km². British
  Columbia's north is sparse, but `highway=track` is a common tag for its forest roads, and those
  count as trails. A guess of **300–900 MB, about 500 MB**. The ratio of output to PBF size (0.69
  for Colorado, 1.23 for Utah) would say 800 MB–1.5 GB, but much of the PBF is buildings, water and
  landcover, which no category selects.
- **Memory:** about 5.2 bytes of RSS per output byte (ADR 0030), so 1.6–4.7 GB under the 12 GiB
  heap on a 16 GB runner.
- **Cells and files:** 1,600–2,100 cells with files, of 3,467 covered. Most ocean cells have none.
  Split cells, at the 4 MiB threshold: perhaps 10–25, in Vancouver (`196_-493`, `197_-493`,
  `196_-492`, `197_-492`), the North Shore, Victoria (`193_-494`), Surrey, Nanaimo, Squamish and
  Whistler, Kelowna and Kamloops, at 3 extra files each. That makes about **1,650–2,200 files**, and
  the site about 3,700–4,200 with the 2,020 it holds now. The guard is 19,000; Cloudflare's free
  plan allows 20,000.
- **Largest file:** Colorado's Denver cell was 30.5 MiB, and its largest quarter 14.2 MiB.
  Sidewalks are `highway=footway`, so they count as trails, and Vancouver's are well mapped. A
  Vancouver quarter could come near the 20 MiB guard (see Risks).
- **Time:**
  - the 1.2 GB download takes 2–10 minutes: Colorado's 370 MB took 40 s, Utah's 163 MB 87 s;
  - MD5 a few seconds; osmium about 2–3 minutes; the build 1–2 minutes;
  - the upload is about 100–250 MB zipped.
  About **5–15 minutes** for British Columbia's job, which sets the run's wall time; the other
  regions run in parallel and take 1–4 minutes. The deploy job grows with one more artifact,
  perhaps 1–2 minutes. All far inside the limits (120 and 30 minutes). The repository is public, so
  standard runners are free.

## Risks / Trade-offs

- **[Risk] A file over 20 MiB**, most likely a Vancouver quarter. There is no second split level
  (ADR 0017), so only British Columbia's job fails, naming the file and its size, and the other
  four still publish. The fix would be a new change to the split rule, with the measured size.
- **[Risk] Memory beyond the estimate.** If the output were much over 2 GB, even 12 GiB could be
  short. Only British Columbia's job fails; the job summary of its failed run gives no size, so the
  fallback is ADR 0030's option (b), writing files as they are built.
- **[Risk] The bounds fail the guard.** This is unlikely, since they were checked against the real
  polygon, but Geofabrik can redraw it. Only British Columbia's job fails, naming the first failing
  point.
- **[Trade-off] Category gaps that bite harder here:**
  - forest service roads tagged `highway=service` or `unclassified` are not selected;
  - rail trails tagged `highway=cycleway` are not selected;
  - summits tagged `natural=volcano` are not peaks;
  - huts and parking mapped as areas are missed.
  The rules are a copy of garmin-map's ("The category rules name the garmin-map commit they were
  copied from"), so these are logged with the owner as category-rule work for both repositories,
  outside this change.
- **[Trade-off] Data from outside the province:** Alberta's side of the Divide, the Alaska panhandle
  near Stewart, and a 50 m strip south of 49° N are in British Columbia's files. The app dedupes by
  `_osmId` once a neighbour is added.
- **[Trade-off] A large `coverage`:** 3,467 ids, many of them open ocean where the source can hold
  data but has none. That is ADR 0021's rule as decided.

## Open Questions

None for the owner. The bounds and the order are the change author's choices (ADRs 0032 and 0033),
as the orchestrator's brief, relaying the owner, says. Publishing timing is ADR 0027, and the heap is ADR 0030, both
already decided.

## Spec review

One round: no blocker, no should-fix. Fixed:
- the proposal no longer calls -130 "the coast" (D1);
- the south line's closest stretch to the bounds, 49.0003 from -121.74 to -123.30, and the Point Roberts turn are described (D2);
- task 1.2 says the four-region assembler test takes the first four entries (E1);
- task 2.2 drops the case already pinned by "A polygon that meets a cell only along its edge" (E2);
- the open questions say the brief relays the owner (H1).

G1, that -130.14 would touch the vertex, was checked and is not so: the vertex is at -130.1435, so -130.14 passes and -130.15 fails. Option (b) now says so.

## Conformance review

Verdict: conforms, no findings. Mutation spot checks each failed a test: the entry dropped or swapped with Idaho, the manifest ordered by id, and `Math.trunc` for `Math.floor` in the cell loop.
