---
status: superseded by 0017
date: 2026-11-07
decision-makers: the owner (answer to weekly-extract design open question 1)
---
# The split threshold is 4 MiB until the first Colorado run measures the cells

## Context and Problem Statement

A 0.25° cell whose file would be over the split threshold is written as four 0.125° quarters (ADR
0002). Until real data had been built, no cell size had been measured, so the threshold had to start
somewhere.

## Considered Options

- 4 MiB (4,194,304 bytes) now, set again from the first run's measurement
- A larger value, so that fewer cells split
- Splitting every cell (0.125° everywhere)

## Decision Outcome

Chosen option: "4 MiB now, set again from the measurement", the owner's choice of the default. It
keeps a split city cell's quarters at a few MiB each, far under the 20 MiB guard, and it is one
constant (`SPLIT_THRESHOLD`) that is easy to change.

### Consequences

- Good, because the first run can publish with no further decision.
- Neutral, because changing the threshold later means a change with its own ADR. That ADR supersedes
  this one.
