---
status: accepted
date: 2026-11-13
decision-makers: the change's author (change british-columbia-region, design decision 2); bounds are the change author's choice, as the orchestrator's brief relaying the owner says
---
# British Columbia's bounds are 49.01 / -130.00 / 59.99 / -120.01

## Context and Problem Statement

A region's `bounds` must lie inside its Geofabrik polygon. British Columbia is irregular: the coast,
the Alaska panhandle, and the Alberta line along the Continental Divide south of 53.8° N. No
rectangle spans the province. Since ADR 0020, `coverage` says where a region has data, so `bounds`
matter only for the guard and for an app that reads nothing else.

Unlike for the states, `british-columbia.poly` could be read from the agent container, through the
agent's web-fetch tool; `curl` to Geofabrik was still reset. Each candidate was checked against it
with the repository's own `polyFailure`.

## Considered Options

- (a) 49.01 / -130.00 / 59.99 / -120.01: about 109.7 square degrees, inside
- (b) 49.01 / -130.14 / 59.99 / -120.01: the widest that passes, 0.0035° from the polygon's
  vertex at (55.27, -130.1435), the head of Portland Inlet; -130.15 fails
- (c) A box reaching east of -120 into the Kootenays: it must stop under the Divide, e.g.
  49.01 / -121.73 / 53.79 / -114.6 fails at its north-east corner

## Decision Outcome

Chosen option: "(a)". Its south, north and east edges are 0.01° inside the 49th parallel, the 60th
and the 120th meridian, as ADRs 0016, 0018 and 0024 did. Its west edge keeps 0.14° from
Geofabrik's vertex, which can move between extracts. The polygon's south line is at 49.0003–49.0007
from -121.74 to -123.30, its closest approach, about 1 km south of the bounds' south edge. (b) gains
0.14° of mostly sea at the risk of a redrawn vertex. (c) is much smaller.

### Consequences

- Good, because the rectangle holds Vancouver, Kamloops, Kelowna, Prince George and Fort St. John,
  and the guard checks it on every run, naming the point if Geofabrik redraws the polygon; only
  British Columbia's job would fail.
- Bad, because Victoria, the Kootenays, Haida Gwaii and the north-west are outside `bounds`. They
  are in `coverage`, so only an app reading `bounds` alone misses them.
