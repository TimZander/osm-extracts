---
status: accepted
date: 2026-11-13
decision-makers: the owner (change coverage-by-cells, design open question 7, answered 2026-11-13)
---
# The deploy job sets no limit on `coverage`'s size or extent, for now

## Context and Problem Statement

The deploy job checks only the form of `coverage`. It doesn't check its length, or whether it lies
near the region's `bounds`, and `manifest.json` has no size guard.

## Considered Options

- (a) No limit now
- (b) At most a fixed count per region
- (c) Every covered cell within a margin of `bounds`

## Decision Outcome

Chosen option: "(a) no limit now", accepted by the owner on 2026-11-13. The ids come from this
repository's own region job, the coverage count is in each job's summary, and at about 10 KB per
state-sized region the manifest stays far from any limit.

### Consequences

- Good, because nothing more to maintain.
- Bad, because a broken job could publish an oversized or misplaced `coverage`. A limit would be a
  new requirement, in its own change.
