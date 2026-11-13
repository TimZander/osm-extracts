---
status: accepted
date: 2026-11-13
decision-makers: the owner (change wyoming-region, design open question 3)
---
# Wyoming merges only after garmin-map searches every region a view overlaps

## Context and Problem Statement

Merging Wyoming means the next run publishes it, and the weekly schedule (ADR 0010) runs whether or
not the owner starts one. Until garmin-map searches every region a view overlaps, a view across the
Colorado–Wyoming line reads only one region.

## Considered Options

- Merge only once garmin-map's multi-region search has merged (garmin-map #298)
- Merge now, and accept single-region reads across the line for a while

## Decision Outcome

Chosen option: "merge only once garmin-map's multi-region search has merged". The owner said "merge"
on the condition that garmin-map #298 merges first, so the first Wyoming publish never meets an app
that can't read it with Colorado.

### Consequences

- Good, because no published state of the site is read wrongly by the app.
- Neutral, because the extract workflow isn't started by hand: the next Monday run publishes Wyoming.
