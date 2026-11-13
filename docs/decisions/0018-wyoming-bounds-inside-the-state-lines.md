---
status: accepted
date: 2026-11-13
decision-makers: the owner (accepted the design's assumption with the merge of PR #8; change wyoming-region, design open question 1)
---
# Wyoming's bounds lie just inside the state lines: 41.01 / -111.04 / 44.99 / -104.06

## Context and Problem Statement

Wyoming is the second region (ADR 0006). Its `bounds` must lie inside Geofabrik's polygon for the
state, and that polygon couldn't be read from the agent container: every fetch was reset. Colorado's
north edge is 40.99 (ADR 0016), so an inset Wyoming leaves a strip on the state line that neither
region's bounds cover.

## Considered Options

- (a) Bounds just inside the state lines, like Colorado's: 41.01 / -111.04 / 44.99 / -104.06
- (b) South on the line, 41.0, the rest as (a)
- (c) South at 40.99, meeting Colorado's north edge
- (d) Bounds read from `wyoming.poly` (and `colorado.poly`)

## Decision Outcome

Chosen option: "(a) just inside the state lines". The owner didn't pick another option, and so
accepted the design's assumption. This is the reasoning of ADR 0016: the rectangle lies inside the
state, and so inside Geofabrik's polygon whatever its margin, with no polygon to read. The guard
checks it on every run.

### Consequences

- Good, because the first run should pass the guard. If it doesn't, only Wyoming's job fails, naming
  the point, and Colorado still publishes.
- Bad, because the strip from 40.99 to 41.01 (about 2.2 km) on the Colorado line is in neither
  region's bounds, and there are strips of up to about 0.016° along Wyoming's other lines.
- Neutral, because the owner's decision to describe coverage by 0.25° cells (the next change) closes
  the Colorado gap whatever these bounds are: 41° N is a cell boundary.
