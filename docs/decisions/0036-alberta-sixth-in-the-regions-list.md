---
status: accepted
date: 2026-11-13
decision-makers: the change's author (change alberta-region, design decision 3); the orchestrator's brief of 2026-11-13, relaying the owner, leaves the order to the change's author
---
# Alberta goes sixth in the regions list, after British Columbia

## Context and Problem Statement

The manifest lists regions in regions-list order. Alberta is the sixth region and the second in
Canada.

## Considered Options

- Append it, after British Columbia
- Alphabetical order, which moves every existing region
- Group by country (US states, then Canadian provinces), which is the same as appending today

## Decision Outcome

Chosen option: "append it", as ADRs 0025, 0029 and 0033 did, because it keeps the order the regions
were added in and moves no existing region. The app searches every region a view overlaps and reads
each one's `coverage`, so the order changes nothing it shows.

### Consequences

- Good, because no existing region's position changes.
- Neutral, because the list is neither alphabetical nor grouped by country; nothing depends on
  either.
