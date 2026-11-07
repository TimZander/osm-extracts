---
status: superseded by 0016
date: 2026-11-07
decision-makers: the owner (answers to weekly-extract design open questions 4 and 6)
---
# Colorado's bounds are the state's bounding box, and Colorado is not clipped

## Context and Problem Statement

A region's `bounds` tell the app where the extract has data, and they must lie inside Geofabrik's
polygon for the region. Clipping cuts a region down to its bounds. It is meant for regions taken out
of a larger extract.

## Considered Options

- Bounds 37 / -109.06 / 41 / -102.04 (south, west, north, east), not clipped
- The same bounds, clipped
- Smaller bounds with a margin inside the state line

## Decision Outcome

Chosen option: "the state's bounding box, not clipped", the owner's choice of the default. Colorado's
lines are its own extract's edges. The first run checks the bounds against Geofabrik's polygon and
fails the region, naming it, if they reach outside.

### Consequences

- Good, because an area anywhere in the state lies inside the bounds.
- Bad, because a few dozen edge cells outside the bounds hold neighbouring data that the app never
  reads for an area inside them. Setting `clip` to `true` would drop them.
- **Disproved by the first run (2026-11-07, run 42329501017):** these bounds reach outside
  Geofabrik's Colorado polygon, and the region failed at the guard (`docs/measurements.md`). New
  bounds need the owner's decision, in a record that supersedes this one.
