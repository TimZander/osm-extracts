---
status: accepted
date: 2026-11-13
decision-makers: the change's author (change utah-region, design open question 2); the owner considers it settled by coverage by cells (ADR 0020), so it was not put to them
---
# Utah goes third in the regions list, after Wyoming

## Context and Problem Statement

The manifest lists regions in regions-list order. Utah is the third region.

## Considered Options

- Append it, after Wyoming
- Alphabetical order (`colorado`, `utah`, `wyoming`), which moves Wyoming

## Decision Outcome

Chosen option: "append it". It keeps the order the regions were added in and moves no existing
region. The app searches every region a view overlaps and reads each one's `coverage`, so the order
changes nothing it shows.

### Consequences

- Good, because no existing region's position changes.
- Neutral, because the list isn't alphabetical; nothing depends on it being so.
