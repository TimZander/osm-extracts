---
status: proposed
date: 2026-11-13
decision-makers: the owner (change coverage-by-cells, design open questions 5 and 7; question 5 left open on purpose, 7 asked)
---
# A clipped region covers its bounds' cells; `coverage` has no size limit for now

## Context and Problem Statement

ADR 0021 settles coverage for unclipped regions. A clipped region's data is cut to its `bounds`, so
its polygon's cells would claim data it can't hold. Separately, the deploy job checks only the form
of `coverage`, not its length or its extent. No region is clipped today.

## Considered Options

Clipped regions:
- Coverage is the cells sharing area with `bounds`
- Coverage is the polygon's cells

Size:
- (a) No limit now
- (b) A fixed count per region
- (c) Every covered cell within a margin of `bounds`

## Decision Outcome

Proposed, and built on, until the owner decides:

- **A clipped region's coverage is its `bounds`' cells.** The owner left this open on purpose.
- **No limit (a).** The ids come from this repository's own region job, the coverage count is in
  each job's summary, and the manifest stays far from any limit.

### Consequences

- Good, because nothing claims data a region can't hold.
- Bad, because a clipped region's edge cells are covered whole while its data stops at `bounds`.
- Bad, because a broken job could publish an oversized `coverage`. A limit would be a new
  requirement, in its own change.
