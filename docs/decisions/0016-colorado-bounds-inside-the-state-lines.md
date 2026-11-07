---
status: accepted
date: 2026-11-07
decision-makers: the owner (accepted by merging PR #4; change colorado-bounds-and-empty-push, design open question 1)
---
# Colorado's bounds lie just inside the state lines: 37.01 / -109.04 / 40.99 / -102.06

## Context and Problem Statement

The first run showed that Colorado's bounding box (37 / -109.06 / 41 / -102.04, ADR 0009) reaches
outside Geofabrik's polygon for the state. The polygon couldn't be read from the agent container to
find the inner box: the fetch was reset each time.

## Considered Options

- Bounds just inside the state lines, so they lie inside the state, and so inside any buffered outline of it
- The polygon's inner box, read from `colorado.poly`
- Bounds well inside the state, with a wide margin

## Decision Outcome

Chosen option: "just inside the state lines", accepted by the owner with PR #4. Each edge sits on the
state's side of its line:

- south 37.01, where the line runs about 36.999 to 37.00;
- west -109.04, where it runs about -109.045 to -109.050;
- north 40.99, where it lies close to 41.00;
- east -102.06, where it runs about -102.042 to -102.052.

So the rectangle lies inside the state whatever Geofabrik's margin.

### Consequences

- Good, because it needs no reading of the polygon. The guard checks it on every run, and names the
  failing point if it is ever wrong.
- Bad, because strips of up to about 0.02° along the borders have no data, and a search touching one
  gets the "no data" message.
- This supersedes ADR 0009.
