---
status: proposed
date: 2026-11-07
decision-makers: the owner (the target regions, garmin-map ADR 0235); the order after Colorado is still the owner's call
---
# Regions: Colorado first, then one region at a time, each its own job

## Context and Problem Statement

The target is most western US states and southern Alberta and British Columbia. A runner holds one
PBF at a time, and a Pages deploy must finish uploading within 20 minutes.

## Considered Options

- One `regions.json` entry per Geofabrik extract, added one at a time, each built by its own matrix job
- One large extract (`us-west`, which includes Alaska and Hawaii)

## Decision Outcome

Chosen option: "one entry per region, one at a time" (garmin-map ADR 0235), because a failed region
then keeps its previous files without holding the others back, and each deploy's new upload stays at
about one region. This change lists only `colorado`.

### Consequences

- Good, because adding a region is one list entry, and the app needs no change.
- Bad, because states that aren't rectangles need a coverage decision before they are added (design
  open question 2; garmin-map's open question 12).
- The order after Colorado is the owner's call (design open question 3).
