---
status: accepted
date: 2026-11-13
decision-makers: the change's author (change alberta-region, design decision 2); the orchestrator's brief of 2026-11-13, relaying the owner, leaves the bounds to the change's author
---
# Alberta's bounds are 49.60 / -114.60 / 59.99 / -110.01

## Context and Problem Statement

A region's `bounds` must lie inside its Geofabrik polygon. No rectangle spans Alberta, because its
west side follows the Continental Divide diagonally, from (49.0, -114.07) to (53.8, -120.0). Since
ADR 0020, `coverage` says where a region has data, so `bounds` matter only for the guard and for
an app that reads nothing else.

`alberta.poly` (453 points) was read through the agent's web-fetch tool, as for British Columbia;
`curl` to Geofabrik was still reset. Each candidate was checked against it with the repository's
own `polyFailure`. The east edge is -110.01 and the north edge 59.99 throughout.

## Considered Options

- (a) 49.01 / -114.05, from the 49th parallel: 44.4 square degrees. It cuts Calgary, whose
  downtown is at -114.07.
- (b) 49.60 / -114.60: 47.7 square degrees. It holds all of Calgary, Edmonton, Red Deer,
  Lethbridge, Medicine Hat and Fort McMurray.
- (c) 51.00 / -115.67: 50.9 square degrees. It adds Banff and Canmore, but cuts Calgary and drops
  Lethbridge and Medicine Hat.
- (d) 53.39 / -119.73, the largest that passes: 64.2 square degrees. It holds Edmonton, Grande
  Prairie and Fort McMurray, but no Calgary.

## Decision Outcome

Chosen option: "(b)", because it holds the cities, with most of the province's people, so an app
reading only `bounds` gets the useful part.

Its margins:
- the west and south edges keep 0.04° from the Divide's nearest vertices, (49.7206, -114.6401) and
  (49.5615, -114.5881), which can move between extracts;
- the north and east edges are 0.01° inside the 60th parallel and the 4th meridian, as ADRs 0016,
  0018, 0024 and 0032 did.

### Consequences

- Good, because the guard checks the rectangle on every run, naming the point if Geofabrik
  redraws the polygon; only Alberta's job would fail.
- Bad, because Waterton, the Crowsnest Pass, Kananaskis, Banff, Jasper and Grande Prairie are
  outside `bounds`. They are in `coverage`, so only an app reading `bounds` alone misses them.
