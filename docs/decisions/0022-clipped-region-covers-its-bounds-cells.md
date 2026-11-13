---
status: proposed
date: 2026-11-13
decision-makers: the owner (change coverage-by-cells, design open question 5, left open on purpose)
---
# A clipped region covers its bounds' cells

## Context and Problem Statement

ADR 0021 settles coverage for unclipped regions. A clipped region's data is cut to its `bounds`, so
its polygon's cells would claim data it can't hold. No region is clipped today.

## Considered Options

- Coverage is the cells sharing area with `bounds`
- Coverage is the polygon's cells

## Decision Outcome

Proposed, and built on: a clipped region's coverage is its `bounds`' cells, by the same area rule.
The owner left this open on purpose, so it is not settled until a clipped region is added.

### Consequences

- Good, because nothing claims data a region can't hold.
- Bad, because a clipped region's edge cells are covered whole while its data stops at `bounds`.
