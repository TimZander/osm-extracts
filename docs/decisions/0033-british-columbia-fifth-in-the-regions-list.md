---
status: accepted
date: 2026-11-13
decision-makers: the change's author (change british-columbia-region, design decision 3); not an owner question
---
# British Columbia goes fifth in the regions list, after Idaho

## Context and Problem Statement

The manifest lists regions in regions-list order. British Columbia is the fifth region and the first
outside the United States.

## Considered Options

- Append it, after Idaho
- Alphabetical order (`british-columbia`, `colorado`, `idaho`, `utah`, `wyoming`), which moves every
  existing region
- Group by country (US states, then Canadian provinces), which is the same as appending today

## Decision Outcome

Chosen option: "append it", as ADRs 0025 and 0029 did. It keeps the order the regions were added in
and moves no existing region. The app searches every region a view overlaps and reads each one's
`coverage`, so the order changes nothing it shows.

### Consequences

- Good, because no existing region's position changes.
- Neutral, because the list is neither alphabetical nor grouped by country; nothing depends on
  either.
