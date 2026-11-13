---
status: accepted
date: 2026-11-13
decision-makers: the owner (decided 2026-11-13; change coverage-by-cells)
---
# A region's coverage is the 0.25° cells its state polygon touches, listed in the manifest

## Context and Problem Statement

A region's coverage was one rectangle, `bounds`, lying inside the state. That leaves states that
aren't rectangles mostly uncovered (ADR 0013), and leaves a strip between neighbours' bounds (the
Colorado–Wyoming gap at 41° N, ADRs 0016 and 0018). The app needs to tell where a region has data.

## Considered Options

- Coverage by cells: the manifest lists, per region, each 0.25° cell its state polygon touches,
  empty ones included, and the app decides where data exists from those cells
- Region bounds that overlap their neighbours

## Decision Outcome

Chosen option: "coverage by cells", decided by the owner on 2026-11-13. Overlapping bounds lost
because Idaho's bounding box is about 40–45% outside Idaho; overlap brings order dependency between
regions and silent empty results instead of a no-data message; it names regions on views where they
have no data; and it doesn't carry over to CA, NV, OR, WA and MT. How the cells are expressed and
computed is ADR 0021.

### Consequences

- Good, because irregular states can be added, and neighbours leave no gap: 41° N is a cell line,
  so Colorado covers row 163 and Wyoming row 164.
- Good, because `bounds` stays, so an app that reads only `bounds` keeps working.
- Bad, because a covered border cell next to an unpublished neighbour has data for only part of it.
- This supersedes ADR 0013.
