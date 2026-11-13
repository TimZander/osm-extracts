---
status: accepted
date: 2026-11-13
decision-makers: the change's author (change idaho-region, design decision 2); not an owner question, since coverage by cells (ADR 0020) says where a region has data
---
# Idaho's bounds are the southern block: 42.01 / -117.02 / 43.75 / -111.06

## Context and Problem Statement

Idaho's `bounds` must lie inside its Geofabrik polygon (the guard fails Idaho's job otherwise), and
no rectangle covers much of a state shaped like Idaho: a wide south, a Montana line running
north-west, and a panhandle about 1° wide. `idaho.poly` couldn't be read from the agent container:
every fetch to `download.geofabrik.de` was reset. Since ADR 0020, `coverage` says where a region has
data, so `bounds` matter only for the guard and for an app that reads nothing else.

## Considered Options

- (a) The southern block, 42.01 / -117.02 / 43.75 / -111.06: the Oregon meridian to the Wyoming line,
  north to just south of where the Oregon line turns onto the Snake River (about 43.81)
- (b) The same block taken north to about 44.4, under the Montana line, its west edge east of the
  Snake (about -116.85)
- (c) The largest rectangle read from `idaho.poly`

## Decision Outcome

Chosen option: "(a) the southern block". About 10.4 square degrees, 175 cells, holding Boise, Twin
Falls, Pocatello and Idaho Falls. Its south, west and east edges are just inside straight lines (42.00,
about -117.026, about -111.05), as ADRs 0016, 0018 and 0024 did; its north edge stays clear of the
Snake. (b) is about a third larger but rests on the Snake's course near Payette and Weiser, the line
least well known here. (c) needs a machine that can reach Geofabrik, and gains nothing the cells
don't already give. A rough outline of Idaho's lines, run through the guard's own check, puts (a)
inside.

### Consequences

- Good, because the rectangle lies inside the state whatever Geofabrik's margin, and the guard checks
  it on every run, naming the point if it is wrong; only Idaho's job would fail.
- Bad, because most of Idaho (everything north of 43.75, the panhandle included) is outside `bounds`.
  It is in `coverage`, so only an app reading `bounds` alone misses it.
