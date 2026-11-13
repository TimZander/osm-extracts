---
status: accepted
date: 2026-11-13
decision-makers: the change's author (change utah-region, design open question 1); the owner considers it settled by coverage by cells (ADR 0020), so it was not put to them
---
# Utah's bounds are the block south of the Wyoming notch: 37.01 / -114.03 / 40.99 / -109.06

## Context and Problem Statement

Utah's `bounds` must lie inside its Geofabrik polygon, and the Wyoming notch means no rectangle can
span the whole state. `utah.poly` couldn't be read from the agent container: every fetch was reset.
Since ADR 0020, `coverage` says where a region has data, so `bounds` matter only for the guard and
for an app that reads nothing else.

## Considered Options

- (a) The south block, below 41° N, full width: 37.01 / -114.03 / 40.99 / -109.06
- (b) The west block, west of -111.05, full height: 37.01 / -114.03 / 41.99 / -111.06
- (c) The largest rectangle read from `utah.poly`

## Decision Outcome

Chosen option: "(a) the south block". It is about a third larger than (b) (19.8 against 14.8
square degrees), holds Salt Lake City, and stays clear of the two lines least well known here, the
Idaho line and the notch's west side. Each edge is just inside its line, as ADRs 0016 and 0018 did;
the west edge is -114.03 because the Nevada line reaches about -114.040 at its north end. (c) needs
a machine that can reach Geofabrik, and gains nothing the cells don't already give.

### Consequences

- Good, because the rectangle lies inside the state whatever Geofabrik's margin, and the guard checks
  it on every run, naming the point if it is wrong; only Utah's job would fail.
- Bad, because everything north of 40.99 and strips of about 0.01–0.02° along the other lines are
  outside `bounds`. They are in `coverage`, so only an app reading `bounds` alone misses them.
