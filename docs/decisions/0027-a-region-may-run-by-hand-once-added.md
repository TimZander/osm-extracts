---
status: accepted
date: 2026-11-13
decision-makers: the owner ("I don't mind it being run anytime after a state is added. We don't have to wait for the next Monday.", 2026-11-13)
---
# A region's first extract run may be started by hand as soon as it merges

## Context and Problem Statement

ADRs 0019 and 0026 left a new region's first publish to the weekly run (Mondays 05:23 UTC,
ADR 0010), so a region merged on a Friday waited three days. The repository is public, so a run
costs no Actions minutes.

## Considered Options

- Start one manual run once the region's PR has merged and no other extract run is in progress
- Wait for the weekly run

## Decision Outcome

Chosen option: "start one manual run once it has merged", decided by the owner on 2026-11-13. Utah
was published this way the same day (run 43361499180). The one-region-per-deploy pace of ADR 0006
holds, because each run follows one region's merge.

### Consequences

- Good, because a new region is live minutes after it merges, and its first measurements come from a
  run of its own.
- Neutral, because the weekly run still refreshes every region.
- This supersedes ADR 0026's "Utah publishes on Monday's run", and the consequence in ADR 0019 that
  the workflow isn't started by hand.
