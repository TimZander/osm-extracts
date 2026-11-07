---
status: accepted
date: 2026-11-07
decision-makers: the owner (answer to weekly-extract design open question 2)
---
# Coverage of states that aren't rectangles waits for garmin-map's decision

## Context and Problem Statement

A region's coverage is one rectangle, and it must lie inside the region's Geofabrik polygon. For a
state that isn't a rectangle, that leaves part of the state uncovered. How coverage should be
described is part of the format garmin-map reads (garmin-map's open question 12).

## Considered Options

- Wait: add only rectangular regions until garmin-map decides, then change both repositories
- Decide a new coverage format here first

## Decision Outcome

Chosen option: "wait", because the consumer owns the format (ADR 0001). Until that decision lands,
only regions that are near-rectangles are added.

### Consequences

- Good, because the two repositories don't drift apart.
- Bad, because states such as California, Nevada and Idaho can't be added yet.
