# Design: colorado-bounds-and-empty-push

## Context

See proposal.md. Geofabrik is now on the environment's allowed hosts, but every fetch of
`colorado.poly` from this container was reset during the TLS handshake (proxy: `ws_closed_mid_exchange`
after about 3 s, three attempts between 02:47 and 02:52 UTC). So the polygon could not be read here.

## Decisions

1. **Colorado's bounds go inside the state lines.**
   - Geofabrik cuts each US state with a polygon a little larger than the state. The first run showed
     that the margin is smaller than the overshoot of the old bounds.
   - Colorado's lines aren't straight: the west line runs from about -109.045 (Four Corners) to about
     -109.050 (the north-west corner); the east line from about -102.042 to about -102.052; the north
     line lies close to 41.00; the south line from about 36.999 to 37.00.
   - The new bounds are 37 / -109.04 / 40.99 / -102.06 (south, west, north, east). Each edge lies on
     the state's side of its line, so the rectangle lies inside the state, and so inside the polygon,
     whatever Geofabrik's margin.
   - What is lost: strips at most about 0.02° wide along the east and west lines, and 0.01° along the
     north line. A search touching a strip gets the "no data" message.
   - Alternative, rejected for now: read the polygon and set the bounds to its inner box. That needs
     the polygon, and it would cover neighbouring states' edges with data that stops at Geofabrik's
     cut.
2. **The guard names the first failing point.** `rectInsidePoly` returns the first failure it finds,
   in the order of the spec's rule: a ring edge meeting the rectangle's edges (its two ends), a ring
   vertex inside, then a corner outside, with its compass name. `build-region` puts that in the error.
3. **No empty push, checked in `publish.sh prepare`.** It reads the assembled `manifest.json` and,
   when `regions` is empty, writes `changed=false` with a log line, so the push step is skipped.
   - The deploy job still succeeds. A run whose regions all failed is already red through its region
     jobs.
   - Keeping the check in `prepare`, beside the unchanged-tree check, means both reasons for not
     pushing are in one place.

## Risks / Trade-offs

- **[Risk] The new bounds still fail** (Geofabrik's polygon cuts inside the state somewhere) →
  the improved guard names the point, and nothing is pushed.
- **[Trade-off] The current live site lists no region** (`fb60804`). The rule doesn't undo that. The
  next run that builds Colorado replaces it.

## Open Questions

1. **The exact bounds.** *Assumption:* 37 / -109.04 / 40.99 / -102.06, until someone reads
   `colorado.poly` and the owner wants larger ones. The next run checks them.
