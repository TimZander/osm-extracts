---
status: accepted
date: 2026-11-07
decision-makers: the owner (answer to weekly-extract design open question 3)
---
# The order of regions after Colorado stays the owner's call, one region at a time

## Context and Problem Statement

ADR 0006 adds regions one at a time, Colorado first. The order of the rest was open.

## Considered Options

- No order fixed now: each next region is the owner's call when it is added
- A fixed order agreed now

## Decision Outcome

Chosen option: "the owner's call each time", the owner's choice of the default. Each region is one
entry in `regions.json` and its own deploy, so nothing needs the order in advance.

### Consequences

- Good, because the order can follow what the owner needs next.
- Neutral, because any region that isn't a rectangle also waits on ADR 0013.
