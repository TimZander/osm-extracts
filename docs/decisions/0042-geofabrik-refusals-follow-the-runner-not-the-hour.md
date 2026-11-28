---
status: accepted
date: 2026-11-23
decision-makers: the owner (2026-11-23, "Yes" to keeping 14:23 UTC and recording that the time-of-day reasoning wasn't confirmed)
---
# Geofabrik's refusals follow the runner, not the hour; ADR 0039's schedule stays

## Context and Problem Statement

ADR 0039 moved the schedule from 05:23 to 14:23 UTC, because it read the failures of runs #11 and
#12 as following the time of day. The re-run of run #12 at 15:05 UTC then had Colorado, Idaho and Utah
refused on every attempt, while Wyoming and Alberta, on other runners, built. Run #9 on 2026-11-13
had British Columbia refused in the afternoon as well.

## Considered Options

- Record that the refusals follow the runner, keep 14:23 UTC
- Return to 05:23 UTC
- Supersede ADR 0039 with a new schedule

## Decision Outcome

Chosen option: "record that the refusals follow the runner, keep 14:23 UTC". The hour wasn't the
cause, and 14:23 does no harm. ADR 0039's decision stands. This record corrects its reasoning, and
ADR 0041 is the fix.

### Consequences

- Good, because the reasoning on record matches the evidence.
- Neutral, because the cause is still inferred from GitHub's logs; agent containers can't reach
  Geofabrik to test it.
