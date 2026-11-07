---
status: accepted
date: 2026-11-07
decision-makers: the owner (answer to weekly-extract design open question 5)
---
# The extract is rebuilt every Monday at 05:23 UTC

## Context and Problem Statement

Geofabrik publishes its extracts daily. Pages allows 500 builds a month. The schedule only needs to
keep the data within a week of Geofabrik's.

## Considered Options

- Weekly, Mondays at 05:23 UTC
- Daily
- Weekly, on the hour

## Decision Outcome

Chosen option: "weekly, Mondays at 05:23 UTC", the owner's choice of the default. Geofabrik's daily
files are usually out by then, and a minute off the hour avoids the top-of-hour rush of scheduled
runs. A run can also be started by hand at any time.

### Consequences

- Good, because the data is never more than about a week old, and the app shows its date.
- Neutral, because GitHub may start a scheduled run some minutes late.
