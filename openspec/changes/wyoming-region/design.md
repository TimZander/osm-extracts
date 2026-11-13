# Design: wyoming-region

## Context

See proposal.md. `download.geofabrik.de` resets every connection from the agent container (proxy:
`ws_closed_mid_exchange`, two attempts on 2026-11-13), so `wyoming.poly` couldn't be read here, as for
Colorado (the colorado-bounds-and-empty-push design).

## Decisions

1. **Wyoming is one plain list entry, not clipped.** Its lines are its own Geofabrik extract's edges,
   the same case as Colorado (ADR 0009's clip reasoning, kept by ADR 0016). Not clipping keeps a few
   edge cells outside the bounds with neighbouring data, which the app doesn't read for an area
   inside them.
2. **The bounds are proposed just inside the state lines**, for the reason ADR 0016 gives: with the
   polygon unreadable, a rectangle inside the state lies inside Geofabrik's polygon whatever its
   margin, and the guard confirms it on every run. Wyoming's lines, from general knowledge, not from
   the polygon:
   - south: close to 41.00 (about 40.995 to 41.002);
   - west: about -111.046 to -111.056;
   - north: close to 45.00 (up to about 45.006);
   - east: about -104.052 to -104.053.

   Proposed: south 41.01, west -111.04, north 44.99, east -104.06.
3. **Wyoming goes after Colorado** in the list, so the manifest lists it second.
4. **This is an sdd change, not a data-only edit.** Adding a region changes what a run publishes, and
   its bounds are an open owner decision, which belongs in a design's open questions. The spec gains a
   scenario only; no rule changes.

## Risks / Trade-offs

- **[Risk] The bounds still fail the guard** → the Wyoming job fails naming the first failing point.
  Colorado still publishes, and Wyoming, never published, is left out of the manifest.
- **[Trade-off] Strips with no data:** about 0.01° along the north and south lines and up to about
  0.016° along the west line, and 0.008° along the east. A search touching one gets "no data".
- **[Risk] Size:** Wyoming has far fewer trails than Colorado (whose largest file is 14.2 MiB), so no
  file is expected near the 20 MiB guard, and the site stays far under 19,000 files (Colorado: 551
  region files; Wyoming's bounds span about 16 × 28 cells).

## Open Questions

1. **Wyoming's bounds, and the gap at the Colorado line.** Colorado's north is 40.99 (ADR 0016). With
   Wyoming's south at 41.01, the strip from 40.99 to 41.01 (about 2.2 km) is in neither region's
   bounds, so the app won't search it. ADR 0016's inset exists only because the polygon couldn't be
   read: it trades those strips for bounds that pass the guard without reading it. The options:
   - (a) inset like Colorado: 41.01 / -111.04 / 44.99 / -104.06. Known to lie inside the state; the
     2.2 km gap stays.
   - (b) south on the line, 41.0 (the rest as (a)). Halves the gap to Colorado's 0.01°. It passes only
     if Geofabrik's polygon reaches past 41.0 all along the line (the line dips to about 40.995 in
     places, and a point on a ring counts as outside).
   - (c) south at 40.99, meeting Colorado's north: no gap, but it reaches about 0.01° into Colorado,
     so it depends on Geofabrik's margin being at least that.
   - (d) read `wyoming.poly` (and `colorado.poly`) from a machine that can reach Geofabrik, and set
     the edges from the polygons. Closing the gap fully would also mean moving Colorado's north,
     which is a change to ADR 0016.

   A failed guard costs one run's Wyoming job, not Colorado's data. *Assumption:* (a), until the owner
   picks another. The answer becomes an ADR.
2. **Utah's overlap.** The owner chose that Utah uses its full bounding box, with the part outside
   Utah's polygon accepted because a listed region (Wyoming) covers it. That is a later change. If
   "covers" is judged by Wyoming's `bounds`, an inset Wyoming leaves strips at 41.0–41.01 and
   -111.05 to -111.04 that Wyoming doesn't cover, so the Utah change must either judge coverage by
   Wyoming's polygon or move Wyoming's south and west edges. *Assumption:* nothing in this change
   decides it; the Utah change does.
