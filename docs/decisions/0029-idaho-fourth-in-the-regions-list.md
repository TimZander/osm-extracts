---
status: accepted
date: 2026-11-13
decision-makers: the change's author (change idaho-region, design decision 3); not an owner question
---
# Idaho goes fourth in the regions list, after Utah

## Context and Problem Statement

The manifest lists regions in regions-list order. Idaho is the fourth region.

## Considered Options

- Append it, after Utah
- Alphabetical order (`colorado`, `idaho`, `utah`, `wyoming`), which moves Utah and Wyoming

## Decision Outcome

Chosen option: "append it", as ADR 0025 did for Utah. It keeps the order the regions were added in
and moves no existing region. The app searches every region a view overlaps and reads each one's
`coverage`, so the order changes nothing it shows.

### Consequences

- Good, because no existing region's position changes.
- Neutral, because the list isn't alphabetical; nothing depends on it being so.
